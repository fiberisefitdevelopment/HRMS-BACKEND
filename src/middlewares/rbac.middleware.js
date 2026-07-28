const ApiError = require('../utils/ApiError');
const { ERROR_CODES } = require('../constants');

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user?.roleSlug) {
    return next(new ApiError(401, 'Authentication required', ERROR_CODES.UNAUTHORIZED));
  }

  if (!allowedRoles.includes(req.user.roleSlug)) {
    return next(
      new ApiError(403, 'You do not have permission to access this resource', ERROR_CODES.FORBIDDEN)
    );
  }

  next();
};

module.exports = { requireRole };
