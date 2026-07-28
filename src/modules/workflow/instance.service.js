const instanceRepository = require('./workflowInstance.repository');
const workflowFacade = require('./workflowFacade.service');
const { SYSTEM_ROLES } = require('../../constants');
const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');

const formatInstance = (i) => ({
  id: i._id,
  companyId: i.companyId,
  templateId: i.templateId,
  workflowType: i.workflowType,
  entityType: i.entityType,
  entityId: i.entityId,
  requesterId: i.requesterId,
  employeeProfileId: i.employeeProfileId,
  departmentId: i.departmentId,
  currentLevelOrder: i.currentLevelOrder,
  currentApproverIds: i.currentApproverIds,
  status: i.status,
  contextData: i.contextData,
  levelStates: i.levelStates,
  startedAt: i.startedAt,
  completedAt: i.completedAt,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
});

const getActorRole = async (userId) => {
  const user = await User.findById(userId).populate('roleId', 'slug');
  return user?.roleId?.slug;
};

const listInstances = async (companyId, query, requester) => {
  const filter = { companyId };
  const role = await getActorRole(requester.id);

  if (query.workflowType) filter.workflowType = query.workflowType;
  if (query.status) filter.status = query.status;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.requesterId) filter.requesterId = query.requesterId;
  if (query.startDate) filter.createdAt = { $gte: new Date(query.startDate) };
  if (query.endDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(query.endDate) };

  if (role === SYSTEM_ROLES.EMPLOYEE) {
    filter.requesterId = requester.id;
  } else if (role === SYSTEM_ROLES.MANAGER && query.mine) {
    filter.currentApproverIds = requester.id;
  }

  if (query.approverId) filter.currentApproverIds = query.approverId;

  const result = await instanceRepository.findWithFilters(filter, query, { companyId });
  return { data: result.data.map(formatInstance), meta: result.meta };
};

const getPendingForApprover = async (companyId, approverId) => {
  const instances = await instanceRepository.findPendingForApprover(companyId, approverId);
  return instances.map(formatInstance);
};

const getDashboard = async (companyId, userId, role) => {
  const pendingApprovals = await instanceRepository.findPendingForApprover(companyId, userId);
  const myRequests = await instanceRepository.findMany(
    { companyId, requesterId: userId },
    { limit: 10, sort: '-createdAt' },
    { companyId }
  );

  const stats = {
    pendingApprovals: pendingApprovals.length,
    myPendingRequests: myRequests.data.filter((i) => i.status === 'pending').length,
    myApprovedRequests: myRequests.data.filter((i) => ['completed', 'approved'].includes(i.status)).length,
    escalated: 0,
  };

  if ([SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(role)) {
    const escalated = await instanceRepository.findMany(
      { companyId, status: 'escalated' },
      { limit: 100 },
      { companyId }
    );
    stats.escalated = escalated.meta.total;
  }

  return {
    pendingApprovals: pendingApprovals.map(formatInstance),
    myRequests: myRequests.data.map(formatInstance),
    stats,
  };
};

module.exports = {
  listInstances,
  getPendingForApprover,
  getDashboard,
  formatInstance,
  ...workflowFacade,
};
