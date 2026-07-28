const mongoose = require('mongoose');
const { SYSTEM_ROLES } = require('../../constants');
const auditLogRepository = require('./auditLog.repository');
const { getTeamUserIds } = require('../managers/team.helper');

const formatUser = (u) => {
  if (!u) return null;
  if (typeof u !== 'object') return { id: String(u) };
  return {
    id: u._id?.toString?.() || u.id,
    fullName: u.fullName,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
  };
};

const formatAuditLog = (doc) => ({
  id: doc._id?.toString?.() || doc.id,
  companyId: doc.companyId?.toString?.() || doc.companyId,
  userId: typeof doc.userId === 'object' ? doc.userId?._id?.toString?.() || doc.userId?.id : doc.userId?.toString?.(),
  subjectUserId:
    typeof doc.subjectUserId === 'object'
      ? doc.subjectUserId?._id?.toString?.() || doc.subjectUserId?.id
      : doc.subjectUserId?.toString?.(),
  actor: formatUser(typeof doc.userId === 'object' ? doc.userId : null),
  subject: formatUser(typeof doc.subjectUserId === 'object' ? doc.subjectUserId : null),
  action: doc.action,
  entityType: doc.entityType,
  entityId: doc.entityId?.toString?.() || doc.entityId || null,
  changes: doc.changes || null,
  metadata: doc.metadata || {},
  ipAddress: doc.ipAddress || null,
  createdAt: doc.createdAt,
});

const getActorRole = async (userId) => {
  const User = require('../users/user.model');
  const user = await User.findById(userId).populate('roleId', 'slug');
  return user?.roleId?.slug || user?.roleSlug;
};

const collectOwnedEntityIds = async (userIds, companyId) => {
  const ids = userIds.map((id) => new mongoose.Types.ObjectId(id));
  const LeaveRequest = require('../leave/leaveRequest.model');
  const CompOffRequest = require('../comp-off/compOffRequest.model');
  const RegularizationRequest = require('../regularization/regularizationRequest.model');

  const [leaves, compOffs, regs] = await Promise.all([
    LeaveRequest.find({ companyId, userId: { $in: ids } }).select('_id').lean(),
    CompOffRequest.find({ companyId, userId: { $in: ids } }).select('_id').lean(),
    RegularizationRequest.find({ companyId, userId: { $in: ids } }).select('_id').lean(),
  ]);

  return {
    leaveRequestIds: leaves.map((d) => d._id),
    compOffIds: compOffs.map((d) => d._id),
    regularizationIds: regs.map((d) => d._id),
  };
};

const buildVisibilityFilter = async (requester, companyId) => {
  const role = requester.roleSlug || (await getActorRole(requester.id));

  if ([SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(role)) {
    return {};
  }

  const selfId = new mongoose.Types.ObjectId(requester.id);
  let visibleUserIds = [selfId];

  if (role === SYSTEM_ROLES.MANAGER) {
    const teamIds = await getTeamUserIds(requester.id, companyId);
    visibleUserIds = [selfId, ...teamIds.map((id) => new mongoose.Types.ObjectId(id))];
  }

  const owned = await collectOwnedEntityIds(visibleUserIds, companyId);
  const entityClauses = [];
  if (owned.leaveRequestIds.length) {
    entityClauses.push({ entityType: 'leave_request', entityId: { $in: owned.leaveRequestIds } });
  }
  if (owned.compOffIds.length) {
    entityClauses.push({ entityType: 'comp_off_request', entityId: { $in: owned.compOffIds } });
  }
  if (owned.regularizationIds.length) {
    entityClauses.push({
      entityType: 'regularization_request',
      entityId: { $in: owned.regularizationIds },
    });
  }

  return {
    $or: [
      { userId: { $in: visibleUserIds } },
      { subjectUserId: { $in: visibleUserIds } },
      ...entityClauses,
    ],
  };
};

const listAuditLogs = async (companyId, query, requester) => {
  const filter = { companyId, ...(await buildVisibilityFilter(requester, companyId)) };

  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = String(query.entityType).toLowerCase();
  if (query.userId) {
    const actorFilter = { userId: new mongoose.Types.ObjectId(query.userId) };
    filter.$and = [...(filter.$and || []), actorFilter];
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const result = await auditLogRepository.findWithFilters(filter, query, { companyId });
  return {
    data: result.data.map(formatAuditLog),
    meta: result.meta,
  };
};

module.exports = {
  listAuditLogs,
  formatAuditLog,
};
