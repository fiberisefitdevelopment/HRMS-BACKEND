const ExcelJS = require('exceljs');
const { stringify } = require('csv-stringify/sync');
const path = require('path');
const fs = require('fs');
const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const employeeRepository = require('./employee.repository');
const EmployeeProfile = require('./employeeProfile.model');
const departmentRepository = require('../departments/department.repository');
const designationRepository = require('../designations/designation.repository');
const User = require('../users/user.model');
const { SYSTEM_ROLES } = require('../../constants');

const exportDir = path.resolve(process.cwd(), 'uploads/exports');

if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

const writeFile = async (rows, headers, filename, format) => {
  const filepath = path.join(exportDir, filename);

  if (format === 'csv') {
    const csv = stringify(rows, { header: true, columns: headers });
    fs.writeFileSync(filepath, csv);
    return filepath;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Export');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((h) => row[h] ?? '')));
  await workbook.xlsx.writeFile(filepath);
  return filepath;
};

const exportEmployees = async (companyId, actorId, req, format = 'xlsx') => {
  const result = await employeeRepository.findWithUser(
    { companyId, isDeleted: false },
    { limit: 10000 },
    { companyId }
  );

  const headers = [
    'employeeId',
    'firstName',
    'lastName',
    'officialEmail',
    'phone',
    'department',
    'designation',
    'managerEmail',
    'joiningDate',
    'employmentType',
    'status',
    'workLocation',
  ];

  const rows = result.data.map((p) => ({
    employeeId: p.employeeId,
    firstName: p.userId?.firstName,
    lastName: p.userId?.lastName,
    officialEmail: p.officialEmail,
    phone: p.phone,
    department: p.departmentId?.name,
    designation: p.designationId?.name,
    managerEmail: p.managerId?.email,
    joiningDate: p.joiningDate?.toISOString?.()?.split('T')[0],
    employmentType: p.employmentType,
    status: p.status,
    workLocation: p.workLocation,
  }));

  const filename = `employees-${Date.now()}.${format}`;
  const filepath = await writeFile(rows, headers, filename, format);

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'export',
    entityType: 'employee',
    metadata: { count: rows.length, format },
    req,
  });

  return { filepath, filename, count: rows.length };
};

const exportDepartments = async (companyId, actorId, req, format = 'xlsx') => {
  const result = await departmentRepository.findMany({ companyId }, { limit: 1000 }, { companyId });
  const headers = ['code', 'name', 'description', 'isActive'];
  const rows = result.data.map((d) => ({
    code: d.code,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
  }));
  const filename = `departments-${Date.now()}.${format}`;
  const filepath = await writeFile(rows, headers, filename, format);

  await createAuditLog({ companyId, userId: actorId, action: 'export', entityType: 'department', req });
  return { filepath, filename, count: rows.length };
};

const exportDesignations = async (companyId, actorId, req, format = 'xlsx') => {
  const result = await designationRepository.findMany({ companyId }, { limit: 1000 }, { companyId });
  const headers = ['code', 'name', 'level', 'description', 'isActive'];
  const rows = result.data.map((d) => ({
    code: d.code,
    name: d.name,
    level: d.level,
    description: d.description,
    isActive: d.isActive,
  }));
  const filename = `designations-${Date.now()}.${format}`;
  const filepath = await writeFile(rows, headers, filename, format);

  await createAuditLog({ companyId, userId: actorId, action: 'export', entityType: 'designation', req });
  return { filepath, filename, count: rows.length };
};

const exportManagers = async (companyId, actorId, req, format = 'xlsx') => {
  const managerRole = await require('../roles/role.model').findOne({ slug: SYSTEM_ROLES.MANAGER });
  const managers = await User.find({ companyId, roleId: managerRole?._id }).select('firstName lastName email');

  const headers = ['firstName', 'lastName', 'email', 'teamSize'];
  const rows = await Promise.all(
    managers.map(async (m) => {
      const teamCount = await EmployeeProfile.countDocuments({
        companyId,
        managerId: m._id,
        isDeleted: false,
      });
      return {
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        teamSize: teamCount,
      };
    })
  );

  const filename = `managers-${Date.now()}.${format}`;
  const filepath = await writeFile(rows, headers, filename, format);

  await createAuditLog({ companyId, userId: actorId, action: 'export', entityType: 'manager', req });
  return { filepath, filename, count: rows.length };
};

module.exports = {
  exportEmployees,
  exportDepartments,
  exportDesignations,
  exportManagers,
  exportDir,
};
