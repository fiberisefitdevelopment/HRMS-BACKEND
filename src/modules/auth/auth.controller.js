const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const authService = require('./auth.service');

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body, req);
  sendSuccess(res, { message: 'Login successful', data: result });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id, req.sessionId, req);
  sendSuccess(res, { message: 'Logged out successfully' });
});

const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken, req);
  sendSuccess(res, { message: 'Token refreshed successfully', data: result });
});

const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword(req.user.id, req.body, req);
  sendSuccess(res, { message: 'Password changed successfully. Please login again.' });
});

const switchCompany = catchAsync(async (req, res) => {
  const result = await authService.switchCompany(req.user.id, req.body.companyId, req);
  sendSuccess(res, { message: 'Company switched successfully', data: result });
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, { message: 'Profile retrieved', data: { user, permissions: req.permissions } });
});

const forgotPassword = catchAsync(async (req, res) => {
  const data = await authService.forgotPassword(req.body, req);
  sendSuccess(res, { message: data.message, data });
});

const verifyOtp = catchAsync(async (req, res) => {
  const data = await authService.verifyPasswordResetOtp(req.body);
  sendSuccess(res, { message: data.message, data });
});

const resetPassword = catchAsync(async (req, res) => {
  const data = await authService.resetPasswordWithOtp(req.body, req);
  sendSuccess(res, { message: data.message, data });
});

module.exports = {
  login,
  logout,
  refresh,
  changePassword,
  switchCompany,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
