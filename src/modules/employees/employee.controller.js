const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const employeeService = require('./employee.service');
const importService = require('./import.service');
const exportService = require('./export.service');
const path = require('path');

const create = catchAsync(async (req, res) => {
  const data = await employeeService.createEmployee(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Employee created', data });
});

const update = catchAsync(async (req, res) => {
  const options = {};
  if (req.user.roleSlug === 'employee') options.selfOnly = true;
  if (req.user.roleSlug === 'manager') options.managerTeamOnly = true;

  const data = await employeeService.updateEmployee(
    req.params.id,
    req.body,
    req.companyId,
    req.user.id,
    req,
    options
  );
  sendSuccess(res, { message: 'Employee updated', data });
});

const getById = catchAsync(async (req, res) => {
  const data = await employeeService.getEmployee(req.params.id, req.companyId, req.user);
  sendSuccess(res, { message: 'Employee retrieved', data });
});

const getMe = catchAsync(async (req, res) => {
  const data = await employeeService.getMyProfile(req.user.id, req.companyId);
  sendSuccess(res, { message: 'Profile retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await employeeService.listEmployees(req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Employees retrieved', data, meta });
});

const activate = catchAsync(async (req, res) => {
  const data = await employeeService.activateEmployee(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Employee activated', data });
});

const deactivate = catchAsync(async (req, res) => {
  const data = await employeeService.deactivateEmployee(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Employee deactivated', data });
});

const remove = catchAsync(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Employee deleted' });
});

const bulkActivate = catchAsync(async (req, res) => {
  const results = await employeeService.bulkUpdate(
    req.body.employeeIds,
    { status: 'active' },
    req.companyId,
    req.user.id,
    req,
    'bulk_activate'
  );
  sendSuccess(res, { message: 'Bulk activation completed', data: results });
});

const bulkDeactivate = catchAsync(async (req, res) => {
  const results = await employeeService.bulkUpdate(
    req.body.employeeIds,
    { status: 'inactive' },
    req.companyId,
    req.user.id,
    req,
    'bulk_deactivate'
  );
  sendSuccess(res, { message: 'Bulk deactivation completed', data: results });
});

const bulkDelete = catchAsync(async (req, res) => {
  for (const id of req.body.employeeIds) {
    await employeeService.deleteEmployee(id, req.companyId, req.user.id, req);
  }
  sendSuccess(res, { message: 'Bulk delete completed', data: { count: req.body.employeeIds.length } });
});

const bulkDepartment = catchAsync(async (req, res) => {
  const results = await employeeService.bulkUpdate(
    req.body.employeeIds,
    { departmentId: req.body.departmentId },
    req.companyId,
    req.user.id,
    req,
    'bulk_department_change'
  );
  sendSuccess(res, { message: 'Bulk department update completed', data: results });
});

const bulkDesignation = catchAsync(async (req, res) => {
  const results = await employeeService.bulkUpdate(
    req.body.employeeIds,
    { designationId: req.body.designationId },
    req.companyId,
    req.user.id,
    req,
    'bulk_designation_change'
  );
  sendSuccess(res, { message: 'Bulk designation update completed', data: results });
});

const bulkManager = catchAsync(async (req, res) => {
  const results = await employeeService.bulkUpdate(
    req.body.employeeIds,
    { managerId: req.body.managerId },
    req.companyId,
    req.user.id,
    req,
    'bulk_manager_assignment'
  );
  sendSuccess(res, { message: 'Bulk manager assignment completed', data: results });
});

const importPreview = catchAsync(async (req, res) => {
  const result = await importService.processImport(req.file.path, req.companyId, req.user.id, req, {
    dryRun: true,
  });
  sendSuccess(res, { message: 'Import preview generated', data: result });
});

const importExecute = catchAsync(async (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  const result = await importService.processImport(req.file.path, req.companyId, req.user.id, req, { dryRun });
  sendSuccess(res, { message: dryRun ? 'Dry run completed' : 'Import completed', data: result });
});

const exportData = catchAsync(async (req, res) => {
  const format = req.query.format || 'xlsx';
  const type = req.params.type || 'employees';

  const exporters = {
    employees: exportService.exportEmployees,
    departments: exportService.exportDepartments,
    designations: exportService.exportDesignations,
    managers: exportService.exportManagers,
  };

  const exporter = exporters[type];
  if (!exporter) return res.status(400).json({ success: false, message: 'Invalid export type' });

  const { filepath, filename, count } = await exporter(req.companyId, req.user.id, req, format);
  res.download(filepath, filename);
});

const uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Photo file is required (field: photo)' });
  }
  const filename = path.basename(req.file.path);
  const data = await employeeService.uploadProfilePhoto(
    req.params.id,
    filename,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Profile photo uploaded', data });
});

const uploadMyPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Photo file is required (field: photo)' });
  }
  const filename = path.basename(req.file.path);
  const data = await employeeService.uploadMyProfilePhoto(
    req.user.id,
    filename,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Profile photo uploaded', data });
});

const deletePhoto = catchAsync(async (req, res) => {
  await employeeService.removeProfilePhoto(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Profile photo deleted' });
});

const deleteMyPhoto = catchAsync(async (req, res) => {
  await employeeService.removeMyProfilePhoto(req.user.id, req.companyId, req);
  sendSuccess(res, { message: 'Profile photo deleted' });
});

const getMyPhoto = catchAsync(async (req, res) => {
  const photoUrl = await employeeService.getProfilePhotoUrlForUser(req.user.id, req.companyId);
  if (!photoUrl) throw ApiError.notFound('Profile photo not found');
  return res.redirect(photoUrl);
});

const getPhoto = catchAsync(async (req, res) => {
  const photoUrl = await employeeService.getProfilePhotoUrl(req.params.id, req.companyId);
  if (!photoUrl) throw ApiError.notFound('Profile photo not found');
  return res.redirect(photoUrl);
});

module.exports = {
  create,
  update,
  getById,
  getMe,
  list,
  activate,
  deactivate,
  remove,
  bulkActivate,
  bulkDeactivate,
  bulkDelete,
  bulkDepartment,
  bulkDesignation,
  bulkManager,
  importPreview,
  importExecute,
  exportData,
  uploadPhoto,
  uploadMyPhoto,
  deletePhoto,
  deleteMyPhoto,
  getMyPhoto,
  getPhoto,
};
