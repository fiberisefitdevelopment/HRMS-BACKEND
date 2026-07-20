const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const attendanceService = require('./attendance.service');
const dashboardService = require('./dashboard.service');
const reportService = require('./report.service');
const exportService = require('./export.service');
const musterRollService = require('./musterRoll.service');

const punchIn = catchAsync(async (req, res) => {
  const data = await attendanceService.punchIn(req.user.id, req.companyId, req, req.body.source || 'web');
  sendCreated(res, { message: 'Punched in successfully', data });
});

const punchOut = catchAsync(async (req, res) => {
  const data = await attendanceService.punchOut(req.user.id, req.companyId, req, req.body.source || 'web');
  sendSuccess(res, { message: 'Punched out successfully', data });
});

const updateLocation = catchAsync(async (req, res) => {
  const data = await attendanceService.updateLocation(req.user.id, req.companyId, req.body, req);
  sendSuccess(res, { message: 'Location updated', data });
});

const startBreak = catchAsync(async (req, res) => {
  const data = await attendanceService.startBreak(req.user.id, req.companyId, req.body.breakType, req);
  sendSuccess(res, { message: 'Break started', data });
});

const endBreak = catchAsync(async (req, res) => {
  const data = await attendanceService.endBreak(req.user.id, req.companyId, req.body.breakType, req);
  sendSuccess(res, { message: 'Break ended', data });
});

const getToday = catchAsync(async (req, res) => {
  const data = await attendanceService.getTodayAttendance(req.user.id, req.companyId);
  sendSuccess(res, { message: 'Today attendance retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await attendanceService.listAttendance(req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Attendance records retrieved', data, meta });
});

const correct = catchAsync(async (req, res) => {
  const data = await attendanceService.correctAttendance(req.params.id, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Attendance corrected', data });
});

const employeeDashboard = catchAsync(async (req, res) => {
  const data = await dashboardService.getEmployeeDashboard(req.user.id, req.companyId);
  sendSuccess(res, { message: 'Employee dashboard', data });
});

const managerDashboard = catchAsync(async (req, res) => {
  const data = await dashboardService.getManagerDashboard(req.user.id, req.companyId);
  sendSuccess(res, { message: 'Manager dashboard', data });
});

const managerLiveDashboard = catchAsync(async (req, res) => {
  // Explicit manager filter wins; else authenticated user sees own team; else company-wide (public).
  let managerUserId = req.query.managerUserId || null;
  if (!managerUserId && req.user) {
    managerUserId = req.user.id;
  }

  const data = await dashboardService.getManagerLiveDashboard(managerUserId, req.companyId);
  sendSuccess(res, { message: 'Manager live team dashboard', data });
});

const hrDashboard = catchAsync(async (req, res) => {
  const data = await dashboardService.getHrDashboard(req.companyId);
  sendSuccess(res, { message: 'HR dashboard', data });
});

const report = catchAsync(async (req, res) => {
  const type = req.params.type || req.query.type || 'daily';
  const data = await reportService.generateReport(type, req.companyId, req.query);
  sendSuccess(res, { message: 'Report generated', data });
});

const musterRoll = catchAsync(async (req, res) => {
  const data = await musterRollService.getMusterRoll(req.companyId, req.query);
  sendSuccess(res, { message: 'Muster roll retrieved', data, meta: data.meta });
});

const monthlySummary = catchAsync(async (req, res) => {
  const data = await reportService.getMonthlySummary(
    req.companyId,
    req.user.id,
    req.query.year,
    req.query.month
  );
  sendSuccess(res, { message: 'Monthly summary', data });
});

const exportReport = catchAsync(async (req, res) => {
  const type = req.params.type || 'daily';
  const format = req.query.format || 'xlsx';
  const { filepath, filename } = await exportService.exportReport(
    type,
    req.companyId,
    req.query,
    req.user.id,
    req,
    format
  );
  res.download(filepath, filename);
});

module.exports = {
  punchIn,
  punchOut,
  updateLocation,
  startBreak,
  endBreak,
  getToday,
  list,
  correct,
  employeeDashboard,
  managerDashboard,
  managerLiveDashboard,
  hrDashboard,
  report,
  musterRoll,
  monthlySummary,
  exportReport,
};
