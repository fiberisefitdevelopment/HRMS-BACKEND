const User = require('../../users/user.model');
const Role = require('../../roles/role.model');
const EmployeeProfile = require('../../employees/employeeProfile.model');
const Department = require('../../departments/department.model');
const WorkflowDelegation = require('../workflowDelegation.model');
const { SYSTEM_ROLES } = require('../../../constants');

const getUsersByRoleSlug = async (companyId, roleSlug) => {
  const role = await Role.findOne({ slug: roleSlug, isSystem: true });
  if (!role) return [];
  return User.find({ companyId, roleId: role._id, isActive: true, status: 'active' });
};

const resolveDelegate = async (companyId, userId) => {
  const now = new Date();
  const delegation = await WorkflowDelegation.findOne(
    {
      companyId,
      delegatorId: userId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    },
    null,
    { companyId }
  );
  return delegation?.delegateId || null;
};

const resolveApprovers = async (level, context) => {
  const { companyId, employeeProfileId, departmentId } = context;
  let approverIds = [];

  switch (level.approverType) {
    case 'reporting_manager': {
      const profile = employeeProfileId
        ? await EmployeeProfile.findById(employeeProfileId, 'managerId', { companyId })
        : null;
      if (profile?.managerId) approverIds = [profile.managerId];
      break;
    }
    case 'department_manager': {
      const deptId = departmentId || (employeeProfileId
        ? (await EmployeeProfile.findById(employeeProfileId, 'departmentId', { companyId }))?.departmentId
        : null);
      if (deptId) {
        const dept = await Department.findById(deptId, 'headEmployeeId', { companyId });
        if (dept?.headEmployeeId) {
          const head = await EmployeeProfile.findById(dept.headEmployeeId, 'userId', { companyId });
          if (head?.userId) approverIds = [head.userId];
        }
      }
      break;
    }
    case 'hr': {
      const hrUsers = await getUsersByRoleSlug(companyId, SYSTEM_ROLES.HR);
      approverIds = hrUsers.map((u) => u._id);
      break;
    }
    case 'owner': {
      const owners = await getUsersByRoleSlug(companyId, SYSTEM_ROLES.OWNER);
      approverIds = owners.map((u) => u._id);
      break;
    }
    case 'leave_approver': {
      approverIds = await resolveLeaveApprovers(companyId, employeeProfileId, departmentId);
      break;
    }
    case 'specific_user':
      if (level.approverUserId) approverIds = [level.approverUserId];
      break;
    case 'specific_role': {
      if (level.approverRoleId) {
        const users = await User.find({
          companyId,
          roleId: level.approverRoleId,
          isActive: true,
          status: 'active',
        });
        approverIds = users.map((u) => u._id);
      }
      break;
    }
    default:
      break;
  }

  const withDelegation = [];
  for (const id of approverIds) {
    const delegateId = await resolveDelegate(companyId, id);
    withDelegation.push(delegateId || id);
  }

  return [...new Set(withDelegation.map((id) => id.toString()))].map((id) => id);
};

const resolveLeaveApprovers = async (companyId, employeeProfileId, departmentId) => {
  const context = { companyId, employeeProfileId, departmentId };
  const [managerIds, hrIds, ownerIds] = await Promise.all([
    resolveApprovers({ approverType: 'reporting_manager' }, context),
    resolveApprovers({ approverType: 'hr' }, context),
    resolveApprovers({ approverType: 'owner' }, context),
  ]);
  return [...new Set([...managerIds, ...hrIds, ...ownerIds].map((id) => id.toString()))];
};

const canUserActOnLevel = async (userId, instance, levelState, actorRoleSlug) => {
  const uid = userId.toString();
  const assigned = (levelState.assignedApproverIds || []).map((id) => id.toString());

  if (assigned.includes(uid)) return true;

  if (actorRoleSlug === SYSTEM_ROLES.OWNER) return true;

  if (levelState.approverType === 'leave_approver') {
    if (actorRoleSlug === SYSTEM_ROLES.HR) return true;
    if (actorRoleSlug === SYSTEM_ROLES.MANAGER) return assigned.includes(uid);
  }

  if (actorRoleSlug === SYSTEM_ROLES.HR && ['hr', 'reporting_manager'].includes(levelState.approverType)) {
    return true;
  }

  const delegation = await WorkflowDelegation.findOne(
    {
      companyId: instance.companyId,
      delegateId: userId,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    },
    null,
    { companyId: instance.companyId }
  );

  if (delegation && assigned.includes(delegation.delegatorId.toString())) return true;

  return false;
};

module.exports = { resolveApprovers, resolveLeaveApprovers, canUserActOnLevel, getUsersByRoleSlug, resolveDelegate };
