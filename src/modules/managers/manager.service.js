const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const employeeRepository = require('../employees/employee.repository');
const employeeService = require('../employees/employee.service');
const User = require('../users/user.model');
const { SYSTEM_ROLES } = require('../../constants');

const assignManager = async (employeeProfileId, managerId, companyId, actorId, req) => {
  const profile = await employeeRepository.findByIdWithDetails(employeeProfileId, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  let resolvedManagerId = null;
  if (managerId) {
    resolvedManagerId = await employeeService.validateManager(managerId, companyId);
    if (resolvedManagerId.toString() === profile.userId._id.toString()) {
      throw ApiError.badRequest('Employee cannot be their own manager');
    }
  }

  const previousManagerId = profile.managerId?._id;
  await employeeRepository.updateById(
    employeeProfileId,
    { managerId: resolvedManagerId, updatedBy: actorId },
    { companyId }
  );
  await User.findByIdAndUpdate(profile.userId._id, { managerId: resolvedManagerId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    entityId: employeeProfileId,
    changes: { before: { managerId: previousManagerId }, after: { managerId: resolvedManagerId } },
    metadata: { action: 'manager_assigned' },
    req,
  });

  return employeeService.getEmployee(employeeProfileId, companyId);
};

const removeManager = async (employeeProfileId, companyId, actorId, req) =>
  assignManager(employeeProfileId, null, companyId, actorId, req);

const getTeamMembers = async (managerUserId, companyId, query, requester) => {
  if (requester.roleSlug === SYSTEM_ROLES.MANAGER && requester.id.toString() !== managerUserId.toString()) {
    throw ApiError.forbidden('Managers can only view their own team');
  }

  const manager = await User.findOne({ _id: managerUserId, companyId });
  if (!manager) throw ApiError.notFound('Manager not found');

  const result = await employeeRepository.findTeamByManager(managerUserId, companyId, query);
  return {
    manager: { id: manager._id, firstName: manager.firstName, lastName: manager.lastName, email: manager.email },
    data: result.data.map(employeeService.formatEmployee),
    meta: result.meta,
  };
};

module.exports = {
  assignManager,
  changeManager: assignManager,
  removeManager,
  getTeamMembers,
};
