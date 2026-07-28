const ApiError = require('../../utils/ApiError');
const crypto = require('crypto');
const { comparePassword, hashPassword } = require('../../helpers/password');
const { validatePasswordStrength } = require('../../helpers/passwordValidation');
const { createAuditLog, hashToken } = require('../../helpers/audit');
const { sendPasswordResetOtp } = require('../../helpers/mail');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} = require('../../config/jwt');
const { authLogger } = require('../../config/logger');
const config = require('../../config');
const { ERROR_CODES, SYSTEM_ROLES } = require('../../constants');
const { SWITCHABLE_ROLES } = require('./auth.constants');
const authRepository = require('./auth.repository');
const companyRepository = require('../companies/company.repository');
const Permission = require('../permissions/permission.model');

const GENERIC_OTP_MESSAGE =
  'If an account exists for this email, a password reset OTP has been sent.';

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const generateOtp = (length = config.auth.otpLength) => {
  const digits = Math.max(4, Math.min(8, Number(length) || 6));
  const max = 10 ** digits;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(digits, '0');
};

const clearPasswordResetFields = () => ({
  passwordResetOtpHash: null,
  passwordResetOtpExpiresAt: null,
  passwordResetOtpAttempts: 0,
});

const assertOtpValid = (user, otp) => {
  if (!user?.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw ApiError.badRequest('No active password reset OTP. Please request a new one.');
  }

  if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest('OTP has expired. Please request a new one.');
  }

  const attempts = user.passwordResetOtpAttempts || 0;
  if (attempts >= config.auth.otpMaxAttempts) {
    throw ApiError.badRequest('Too many invalid OTP attempts. Please request a new one.');
  }

  const matches = user.passwordResetOtpHash === hashOtp(otp);
  if (!matches) {
    return { valid: false, attempts };
  }

  return { valid: true, attempts };
};

const buildTokenPayload = (user, role) => ({
  sub: user._id.toString(),
  email: user.email,
  companyId: user.companyId._id?.toString() || user.companyId.toString(),
  roleId: role._id.toString(),
  roleSlug: role.slug,
  refreshTokenVersion: user.refreshTokenVersion,
});

const formatUserResponse = (user) => ({
  id: user._id,
  employeeCode: user.employeeCode,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  profilePhoto: user.profilePhoto,
  isActive: user.isActive,
  isBlocked: user.isBlocked,
  status: user.status,
  lastLogin: user.lastLogin,
  company: user.companyId,
  role: user.roleId
    ? {
        id: user.roleId._id,
        name: user.roleId.name,
        slug: user.roleId.slug,
      }
    : null,
  departmentId: user.departmentId,
  designationId: user.designationId,
  managerId: user.managerId,
  accessibleCompanyIds: user.accessibleCompanyIds,
  createdAt: user.createdAt,
});

const assertAccountAccessible = (user) => {
  if (user.isBlocked) {
    throw new ApiError(403, 'Your account has been blocked. Contact administrator.', ERROR_CODES.ACCOUNT_BLOCKED);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
    throw new ApiError(
      403,
      `Account temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).`,
      ERROR_CODES.ACCOUNT_LOCKED
    );
  }

  if (!user.isActive || user.status !== 'active') {
    throw new ApiError(403, 'Your account is inactive. Contact administrator.', ERROR_CODES.ACCOUNT_INACTIVE);
  }
};

const generateTokens = async (user, role, req) => {
  const payload = buildTokenPayload(user, role);

  const tempHash = hashToken(`${user._id}-${Date.now()}`);
  const session = await authRepository.createSession({
    userId: user._id,
    refreshTokenHash: tempHash,
    refreshTokenVersion: user.refreshTokenVersion,
    companyId: user.companyId._id || user.companyId,
    deviceInfo: { userAgent: req.get('user-agent') },
    ipAddress: req.ip,
    expiresAt: getRefreshTokenExpiry(),
  });

  const refreshToken = signRefreshToken({
    ...payload,
    sessionId: session._id.toString(),
  });

  const refreshTokenHash = hashToken(refreshToken);
  await authRepository.updateSession(session._id, { refreshTokenHash });

  const accessTokenWithSession = signAccessToken({
    ...payload,
    sessionId: session._id.toString(),
  });

  return { accessToken: accessTokenWithSession, refreshToken };
};

const login = async ({ email, password }, req) => {
  const rawLoginId = email?.trim();
  if (!rawLoginId) {
    throw new ApiError(400, 'Email or employee code is required', ERROR_CODES.VALIDATION_ERROR);
  }

  const loginId = rawLoginId.includes('@') ? rawLoginId.toLowerCase() : rawLoginId.toUpperCase();
  const user = loginId.includes('@')
    ? await authRepository.findUserByEmail(loginId)
    : await authRepository.findUserByEmployeeCode(loginId);

  if (!user) {
    authLogger.warn('Failed login — user not found', { loginId, ip: req.ip });
    await createAuditLog({
      action: 'failed_login',
      entityType: 'user',
      req,
      metadata: { loginId, reason: 'user_not_found' },
    });
    throw new ApiError(401, 'Invalid email, employee code or password', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (user.isBlocked) {
    authLogger.warn('Blocked login attempt', { userId: user._id, email });
    await createAuditLog({
      companyId: user.companyId?._id || user.companyId,
      userId: user._id,
      action: 'failed_login',
      entityType: 'user',
      entityId: user._id,
      req,
      metadata: { reason: 'account_blocked' },
    });
    throw new ApiError(403, 'Your account has been blocked', ERROR_CODES.ACCOUNT_BLOCKED);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(403, 'Account temporarily locked. Try again later.', ERROR_CODES.ACCOUNT_LOCKED);
  }

  const isPasswordValid = await comparePassword(password, user.password);

  if (!isPasswordValid) {
    const attempts = user.failedLoginAttempts + 1;
    const updateData = { failedLoginAttempts: attempts };

    if (attempts >= config.auth.maxFailedLoginAttempts) {
      updateData.lockedUntil = new Date(Date.now() + config.auth.lockDurationMinutes * 60 * 1000);
      authLogger.warn('Account locked after failed attempts', { userId: user._id, attempts });
    }

    await authRepository.updateUser(user._id, updateData);

    await createAuditLog({
      companyId: user.companyId?._id || user.companyId,
      userId: user._id,
      action: 'failed_login',
      entityType: 'user',
      entityId: user._id,
      req,
      metadata: { attempts, locked: attempts >= config.auth.maxFailedLoginAttempts },
    });

    if (attempts >= config.auth.maxFailedLoginAttempts) {
      throw new ApiError(
        403,
        `Account locked for ${config.auth.lockDurationMinutes} minutes after ${config.auth.maxFailedLoginAttempts} failed attempts`,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    throw new ApiError(401, 'Invalid email, employee code or password', ERROR_CODES.INVALID_CREDENTIALS);
  }

  assertAccountAccessible(user);

  await authRepository.updateUser(user._id, {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLogin: new Date(),
  });

  const tokens = await generateTokens(user, user.roleId, req);

  authLogger.info('Successful login', { userId: user._id, email: user.email, ip: req.ip });

  await createAuditLog({
    companyId: user.companyId?._id || user.companyId,
    userId: user._id,
    action: 'login',
    entityType: 'user',
    entityId: user._id,
    req,
  });

  return {
    user: formatUserResponse(user),
    tokens,
  };
};

const logout = async (userId, sessionId, req) => {
  if (sessionId) {
    await authRepository.revokeSession(sessionId);
  }

  authLogger.info('User logged out', { userId });

  await createAuditLog({
    companyId: req.companyId,
    userId,
    action: 'logout',
    entityType: 'user',
    entityId: userId,
    req,
  });
};

const refresh = async (refreshToken, req) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', ERROR_CODES.TOKEN_INVALID);
  }

  const user = await authRepository.findUserById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User not found', ERROR_CODES.UNAUTHORIZED);
  }

  assertAccountAccessible(user);

  // Only reject — do not wipe all sessions (that forced repeated logouts on stale tokens)
  if (decoded.refreshTokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(401, 'Refresh token has been revoked', ERROR_CODES.TOKEN_INVALID);
  }

  const tokenHash = hashToken(refreshToken);
  const session = await authRepository.findActiveSession(user._id, tokenHash);

  if (!session) {
    throw new ApiError(401, 'Session not found or expired', ERROR_CODES.TOKEN_INVALID);
  }

  if (decoded.sessionId && decoded.sessionId !== session._id.toString()) {
    throw new ApiError(401, 'Invalid refresh token session', ERROR_CODES.TOKEN_INVALID);
  }

  // Keep the same refresh token + session. Only mint a new access token.
  // Do NOT bump refreshTokenVersion here — that invalidated every in-flight request.
  const payload = buildTokenPayload(user, user.roleId);
  const accessToken = signAccessToken({
    ...payload,
    sessionId: session._id.toString(),
  });

  await authRepository.updateSession(session._id, {
    lastUsedAt: new Date(),
    expiresAt: getRefreshTokenExpiry(),
  });

  authLogger.info('Token refreshed', { userId: user._id });

  return {
    user: formatUserResponse(user),
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

const changePassword = async (userId, { currentPassword, newPassword }, req) => {
  const user = await authRepository.findUserByIdWithPassword(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
  }

  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    throw new ApiError(401, 'Current password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  if (!validatePasswordStrength(newPassword)) {
    throw ApiError.badRequest(
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
    );
  }

  const hashed = await hashPassword(newPassword);
  const newVersion = user.refreshTokenVersion + 1;

  await authRepository.updateUser(userId, {
    password: hashed,
    passwordChangedAt: new Date(),
    refreshTokenVersion: newVersion,
  });

  await authRepository.revokeAllUserSessions(userId);

  authLogger.info('Password changed', { userId });

  await createAuditLog({
    companyId: req.companyId,
    userId,
    action: 'password_change',
    entityType: 'user',
    entityId: userId,
    req,
  });
};

const switchCompany = async (userId, companyId, req) => {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
  }

  const roleSlug = user.roleId?.slug;
  if (!SWITCHABLE_ROLES.includes(roleSlug)) {
    throw new ApiError(403, 'You are not allowed to switch companies', ERROR_CODES.FORBIDDEN);
  }

  const company = await companyRepository.findActiveById(companyId);
  if (!company) {
    throw new ApiError(404, 'Company not found or inactive', ERROR_CODES.NOT_FOUND);
  }

  if (roleSlug === SYSTEM_ROLES.HR) {
    const hasAccess = user.accessibleCompanyIds?.some((id) => id.toString() === companyId);
    if (!hasAccess) {
      throw new ApiError(403, 'You do not have access to this company', ERROR_CODES.FORBIDDEN);
    }
  }

  const previousCompanyId = user.companyId?._id || user.companyId;

  const switchUpdate = { companyId: company._id };
  if (!user.employeeCode) {
    // Backward compatibility: some legacy/demo users were created without employeeCode.
    // Switching company can violate the unique (companyId, employeeCode) index when code is null.
    switchUpdate.employeeCode = `USR${user._id.toString().slice(-6).toUpperCase()}`;
  }

  await authRepository.updateUser(userId, switchUpdate);
  if (switchUpdate.employeeCode) user.employeeCode = switchUpdate.employeeCode;
  user.companyId = company;

  const tokens = await generateTokens(user, user.roleId, req);

  authLogger.info('Company switched', {
    userId,
    from: previousCompanyId,
    to: companyId,
  });

  await createAuditLog({
    companyId: company._id,
    userId,
    action: 'company_switch',
    entityType: 'company',
    entityId: company._id,
    changes: { before: { companyId: previousCompanyId }, after: { companyId: company._id } },
    req,
  });

  return {
    user: formatUserResponse(user),
    tokens,
  };
};

const getMe = async (userId) => {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found', ERROR_CODES.NOT_FOUND);
  }
  return formatUserResponse(user);
};

const forgotPassword = async ({ email }, req) => {
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await authRepository.findUserByEmailForPasswordReset(normalizedEmail);

  // Always return the same message to avoid account enumeration
  if (!user || !user.isActive || user.isBlocked || user.status === 'inactive') {
    return { message: GENERIC_OTP_MESSAGE };
  }

  const otp = generateOtp();
  const expiresMinutes = config.auth.otpExpiresMinutes;
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

  await authRepository.updateUser(user._id, {
    passwordResetOtpHash: hashOtp(otp),
    passwordResetOtpExpiresAt: expiresAt,
    passwordResetOtpAttempts: 0,
  });

  // Always print OTP in development so local testing works even if Brevo blocks delivery.
  if (config.isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(`\n[DEV] Password reset OTP for ${user.email}: ${otp} (expires in ${expiresMinutes} min)\n`);
  }

  try {
    await sendPasswordResetOtp({
      to: user.email,
      otp,
      expiresMinutes,
    });
  } catch (error) {
    if (config.isDevelopment) {
      authLogger.warn('Password reset email failed in development — use OTP from server console', {
        userId: user._id,
        email: user.email,
        error: error.message,
      });
    } else {
      authLogger.error('Failed to send password reset OTP', {
        userId: user._id,
        error: error.message,
      });
      throw ApiError.internal('Failed to send password reset OTP. Please try again later.');
    }
  }

  await createAuditLog({
    companyId: user.companyId,
    userId: user._id,
    action: 'password_reset_request',
    entityType: 'user',
    entityId: user._id,
    req,
  });

  authLogger.info('Password reset OTP issued', { userId: user._id });

  return {
    message: GENERIC_OTP_MESSAGE,
    expiresInMinutes: expiresMinutes,
  };
};

const verifyPasswordResetOtp = async ({ email, otp }) => {
  const user = await authRepository.findUserByEmailForPasswordReset(email);
  if (!user) {
    throw ApiError.badRequest('Invalid or expired OTP');
  }

  const check = assertOtpValid(user, otp);
  if (!check.valid) {
    await authRepository.updateUser(user._id, {
      passwordResetOtpAttempts: check.attempts + 1,
    });
    throw ApiError.badRequest('Invalid or expired OTP');
  }

  return {
    valid: true,
    message: 'OTP verified. You can now reset your password.',
    email: user.email,
  };
};

const resetPasswordWithOtp = async ({ email, otp, newPassword }, req) => {
  const user = await authRepository.findUserByEmailForPasswordReset(email);
  if (!user) {
    throw ApiError.badRequest('Invalid or expired OTP');
  }

  const check = assertOtpValid(user, otp);
  if (!check.valid) {
    await authRepository.updateUser(user._id, {
      passwordResetOtpAttempts: check.attempts + 1,
    });
    throw ApiError.badRequest('Invalid or expired OTP');
  }

  if (!validatePasswordStrength(newPassword)) {
    throw ApiError.badRequest(
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
    );
  }

  const hashed = await hashPassword(newPassword);
  const newVersion = (user.refreshTokenVersion || 0) + 1;

  await authRepository.updateUser(user._id, {
    password: hashed,
    passwordChangedAt: new Date(),
    refreshTokenVersion: newVersion,
    ...clearPasswordResetFields(),
  });

  await authRepository.revokeAllUserSessions(user._id);

  await createAuditLog({
    companyId: user.companyId,
    userId: user._id,
    action: 'password_reset',
    entityType: 'user',
    entityId: user._id,
    req,
  });

  authLogger.info('Password reset via OTP', { userId: user._id });

  return { message: 'Password reset successfully. Please login with your new password.' };
};

const loadUserPermissions = async (user) => {
  if (!user.roleId) return [];

  const role = user.roleId;
  if (role.slug === SYSTEM_ROLES.OWNER) {
    const all = await Permission.find().select('slug');
    return all.map((p) => p.slug);
  }

  if (!role.permissions?.length) return [];

  if (role.permissions[0]?.slug) {
    return role.permissions.map((p) => p.slug);
  }

  const permissionIds = role.permissions.map((p) => p._id || p);
  const permissions = await Permission.find({ _id: { $in: permissionIds } }).select('slug');
  return permissions.map((p) => p.slug);
};

module.exports = {
  login,
  logout,
  refresh,
  changePassword,
  switchCompany,
  getMe,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  formatUserResponse,
  loadUserPermissions,
  assertAccountAccessible,
};
