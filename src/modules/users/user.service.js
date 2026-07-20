const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { authLogger } = require('../../config/logger');
const { ERROR_CODES, SYSTEM_ROLES } = require('../../constants');
const { BLOCK_PERMISSIONS } = require('../auth/auth.constants');
const userRepository = require('./user.repository');
const roleRepository = require('../roles/role.repository');

const canBlockTarget = (actorRoleSlug, targetRoleSlug, actorId, targetId) => {
  if (actorId.toString() === targetId.toString()) {
    return { allowed: false, reason: 'You cannot block yourself' };
  }

  if (targetRoleSlug === SYSTEM_ROLES.OWNER) {
    return { allowed: false, reason: 'Owner account cannot be blocked' };
  }

  const allowedTargets = BLOCK_PERMISSIONS[actorRoleSlug];
  if (!allowedTargets) {
    return { allowed: false, reason: 'You do not have permission to block users' };
  }

  if (!allowedTargets.includes(targetRoleSlug)) {
    return { allowed: false, reason: `You cannot block a user with role: ${targetRoleSlug}` };
  }

  return { allowed: true };
};

const blockUser = async (actorId, { userId, reason }, req) => {
  const actor = await userRepository.findByIdWithRole(actorId);
  const target = await userRepository.findByIdWithRole(userId);

  if (!target) {
    throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
  }

  const actorRoleSlug = actor.roleId.slug;
  const targetRoleSlug = target.roleId.slug;

  const { allowed, reason: denyReason } = canBlockTarget(actorRoleSlug, targetRoleSlug, actorId, userId);
  if (!allowed) {
    throw new ApiError(403, denyReason, ERROR_CODES.FORBIDDEN);
  }

  if (target.isBlocked) {
    throw new ApiError(409, 'User is already blocked', ERROR_CODES.CONFLICT);
  }

  const updated = await userRepository.updateById(userId, {
    isBlocked: true,
    blockedBy: actorId,
    blockedReason: reason,
    blockedAt: new Date(),
    status: 'suspended',
    updatedBy: actorId,
  });

  await require('../auth/auth.repository').revokeAllUserSessions(userId);

  authLogger.info('User blocked', { actorId, targetId: userId, reason });

  await createAuditLog({
    companyId: req.companyId,
    userId: actorId,
    action: 'block',
    entityType: 'user',
    entityId: userId,
    changes: { after: { isBlocked: true, blockedReason: reason } },
    req,
  });

  return updated;
};

const unblockUser = async (actorId, { userId }, req) => {
  const actor = await userRepository.findByIdWithRole(actorId);
  const target = await userRepository.findByIdWithRole(userId);

  if (!target) {
    throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
  }

  const { allowed, reason: denyReason } = canBlockTarget(
    actor.roleId.slug,
    target.roleId.slug,
    actorId,
    userId
  );

  if (!allowed && actor.roleId.slug !== SYSTEM_ROLES.OWNER) {
    throw new ApiError(403, denyReason, ERROR_CODES.FORBIDDEN);
  }

  if (!target.isBlocked) {
    throw new ApiError(409, 'User is not blocked', ERROR_CODES.CONFLICT);
  }

  const updated = await userRepository.updateById(userId, {
    isBlocked: false,
    blockedBy: null,
    blockedReason: null,
    blockedAt: null,
    status: 'active',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    updatedBy: actorId,
  });

  authLogger.info('User unblocked/activated', { actorId, targetId: userId });

  await createAuditLog({
    companyId: req.companyId,
    userId: actorId,
    action: 'activate',
    entityType: 'user',
    entityId: userId,
    changes: { after: { isBlocked: false, status: 'active' } },
    req,
  });

  return updated;
};

module.exports = {
  blockUser,
  unblockUser,
};
