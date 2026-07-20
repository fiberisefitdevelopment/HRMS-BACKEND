const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../config/jwt');
const { authLogger } = require('../config/logger');
const { ERROR_CODES } = require('../constants');
const authRepository = require('../modules/auth/auth.repository');
const authService = require('../modules/auth/auth.service');

const authenticate = catchAsyncWrapper(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    authLogger.warn('Missing authorization header', { path: req.originalUrl, ip: req.ip });
    throw new ApiError(401, 'Authentication required', ERROR_CODES.UNAUTHORIZED);
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    const code = error.name === 'TokenExpiredError' ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID;
    const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    authLogger.warn('JWT validation failed', { message: error.message, path: req.originalUrl });
    throw new ApiError(401, message, code);
  }

  const user = await authRepository.findUserById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User not found', ERROR_CODES.UNAUTHORIZED);
  }

  if (decoded.refreshTokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(401, 'Token has been revoked', ERROR_CODES.TOKEN_INVALID);
  }

  authService.assertAccountAccessible(user);

  const tokenCompanyId = decoded.companyId;
  const userCompanyId = (user.companyId._id || user.companyId).toString();

  if (tokenCompanyId !== userCompanyId) {
    throw new ApiError(401, 'Company context mismatch. Please login again.', ERROR_CODES.TOKEN_INVALID);
  }

  const permissions = await authService.loadUserPermissions(user);

  req.user = {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    employeeCode: user.employeeCode,
    roleId: user.roleId._id,
    roleSlug: user.roleId.slug,
  };
  req.companyId = user.companyId._id || user.companyId;
  req.role = user.roleId;
  req.permissions = permissions;
  req.sessionId = decoded.sessionId;

  next();
});

function catchAsyncWrapper(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { authenticate };
