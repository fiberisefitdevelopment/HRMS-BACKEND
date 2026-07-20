const ApiError = require('../utils/ApiError');
const { ERROR_CODES, SYSTEM_ROLES } = require('../constants');

const requirePermission = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Authentication required', ERROR_CODES.UNAUTHORIZED));
  }

  if (req.user.roleSlug === SYSTEM_ROLES.OWNER) {
    return next();
  }

  const userPermissions = req.permissions || [];
  const hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));

  if (!hasPermission) {
    return next(
      new ApiError(403, 'Insufficient permissions to perform this action', ERROR_CODES.FORBIDDEN)
    );
  }

  next();
};

module.exports = { requirePermission };
