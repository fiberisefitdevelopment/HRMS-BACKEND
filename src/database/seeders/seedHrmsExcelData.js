const path = require('path');
const ExcelJS = require('exceljs');
const Company = require('../../modules/companies/company.model');
const Department = require('../../modules/departments/department.model');
const Designation = require('../../modules/designations/designation.model');
const User = require('../../modules/users/user.model');
const Role = require('../../modules/roles/role.model');
const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const Shift = require('../../modules/shifts/shift.model');
const EmployeeShiftAssignment = require('../../modules/shifts/employeeShiftAssignment.model');
const { hashPassword } = require('../../helpers/password');
const { syncSequenceFromCode } = require('../../modules/employees/employeeId.generator');
const { dbLogger } = require('../../config/logger');
const { SYSTEM_ROLES } = require('../../constants');

const DEFAULT_PASSWORD = '12345';
const HR_EMAIL = 'hr@hrms.local';
const HR_EMPLOYEE_CODE = 'HR0001';
const OWNER_CODE = 'FR0001';
const EXCEL_PATH = path.join(__dirname, '../../../HRMS Data.xlsx');

const SHEET_CONFIG = [
  { sheetName: 'Fiberise Fit Pvt Ltd(P)', companyCode: 'FIBERISE', employmentType: 'full_time' },
  { sheetName: 'Fiberise Fit Pvt Ltd(C)', companyCode: 'FIBERISE', employmentType: 'contract' },
  { sheetName: 'Vytalix Medical Pvt Ltd(P)', companyCode: 'VYTALIX', employmentType: 'full_time' },
  { sheetName: 'Vytalix Medical Pvt Ltd(C)', companyCode: 'VYTALIX', employmentType: 'contract' },
];

const MANAGER_PATTERN = /manager|lead|ceo|cgo|director|head/i;

const splitName = (fullName) => {
  const cleaned = String(fullName || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return { firstName: 'Employee', lastName: '' };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const buildPlaceholderEmail = (employeeCode, companyCode) => {
  const domain = companyCode === 'FIBERISE' ? 'fiberise.hrms.local' : 'vytalix.hrms.local';
  return `${employeeCode.toLowerCase()}@${domain}`;
};

const isDemoRow = (row) => {
  const code = String(row.empCode || '').trim().toUpperCase();
  const name = String(row.empName || '').trim().toLowerCase();
  const designation = String(row.designation || '').trim().toLowerCase();
  return !code || name === 'demo' || designation === 'demo';
};

const resolveRoleSlug = (employeeCode, designation) => {
  if (employeeCode === OWNER_CODE) return SYSTEM_ROLES.OWNER;
  if (MANAGER_PATTERN.test(designation) && employeeCode !== OWNER_CODE) return SYSTEM_ROLES.MANAGER;
  return SYSTEM_ROLES.EMPLOYEE;
};

const ensureDepartment = async (companyId, actorId) => {
  let department = await Department.findOne({ companyId, code: 'GEN' }, null, { companyId });
  if (!department) {
    department = await Department.create({
      companyId,
      name: 'General',
      code: 'GEN',
      description: 'Default department',
      status: 'active',
      createdBy: actorId,
      updatedBy: actorId,
    });
  }
  return department;
};

const ensureDesignation = async (companyId, title, actorId) => {
  const normalized = String(title || 'Staff').trim();
  const code = normalized
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'STAFF';

  let designation = await Designation.findOne({ companyId, code }, null, { companyId });
  if (!designation) {
    designation = await Designation.create({
      companyId,
      name: normalized,
      code,
      level: 1,
      status: 'active',
      createdBy: actorId,
      updatedBy: actorId,
    });
  }
  return designation;
};

const getShiftForWorkingDays = async (companyId, workingDays) => {
  const isSixDay = String(workingDays).includes('6');
  const code = isSixDay ? 'SALES' : 'GENERAL';
  return Shift.findOne({ companyId, code, status: 'active' }, null, { companyId });
};

const parseWorksheetRows = (worksheet) => {
  const rows = [];
  let headerFound = false;

  worksheet.eachRow((row) => {
    const values = row.values.slice(1).map((v) => (v == null ? '' : String(v).trim()));
    if (!headerFound) {
      if (values[0]?.toLowerCase() === 's.no' || values[1]?.toLowerCase() === 'emp_code') {
        headerFound = true;
      }
      return;
    }

    const empCode = values[1];
    const empName = values[2];
    const designation = values[3];
    const workingDays = values[4];
    if (!empCode) return;

    rows.push({ empCode, empName, designation, workingDays });
  });

  return rows;
};

const loadExcelEmployees = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_PATH);
  const employees = [];

  for (const config of SHEET_CONFIG) {
    const worksheet = workbook.getWorksheet(config.sheetName);
    if (!worksheet) {
      dbLogger.warn(`Worksheet not found: ${config.sheetName}`);
      continue;
    }

    const rows = parseWorksheetRows(worksheet);
    for (const row of rows) {
      if (isDemoRow(row)) continue;
      employees.push({
        ...row,
        empCode: row.empCode.toUpperCase(),
        companyCode: config.companyCode,
        employmentType: config.employmentType,
      });
    }
  }

  return employees;
};

const createEmployeeRecord = async ({
  employeeCode,
  firstName,
  lastName,
  email,
  roleSlug,
  companyId,
  companyCode,
  employmentType,
  designationTitle,
  workingDays,
  managerId,
  accessibleCompanyIds,
  actorId,
  hashedPassword,
  departmentId,
}) => {
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { employeeCode, companyId }],
  });

  if (existingUser) {
    dbLogger.info(`Employee already exists — skipping ${employeeCode}`);
    return { user: existingUser, profile: await EmployeeProfile.findOne({ userId: existingUser._id, companyId }) };
  }

  const role = await Role.findOne({ slug: roleSlug, isSystem: true });
  if (!role) throw new Error(`Role ${roleSlug} not found`);

  const designation = await ensureDesignation(companyId, designationTitle, actorId);

  await syncSequenceFromCode({
    companyId,
    companyCode,
    employmentType,
    employeeCode,
  });

  const user = await User.create({
    employeeCode,
    firstName,
    lastName,
    email: email.toLowerCase(),
    password: hashedPassword,
    roleId: role._id,
    companyId,
    accessibleCompanyIds: accessibleCompanyIds || [companyId],
    departmentId,
    designationId: designation._id,
    managerId: managerId || null,
    isActive: true,
    status: 'active',
    refreshTokenVersion: 0,
    createdBy: actorId,
    updatedBy: actorId,
  });

  const profile = await EmployeeProfile.create({
    userId: user._id,
    companyId,
    departmentId,
    designationId: designation._id,
    managerId: managerId || null,
    employeeId: employeeCode,
    officialEmail: email.toLowerCase(),
    joiningDate: new Date('2024-01-01'),
    employmentType,
    workLocation: workingDays || null,
    status: 'active',
    createdBy: actorId,
    updatedBy: actorId,
  });

  const shift = await getShiftForWorkingDays(companyId, workingDays);
  if (shift) {
    await EmployeeShiftAssignment.create({
      companyId,
      employeeProfileId: profile._id,
      userId: user._id,
      shiftId: shift._id,
      effectiveFrom: new Date('2024-01-01'),
      isActive: true,
      assignedBy: actorId,
    });
  }

  return { user, profile };
};

const createHrUser = async ({ companies, departmentMap, hashedPassword, ownerUser }) => {
  const primaryCompany = companies.find((c) => c.companyCode === 'FIBERISE') || companies[0];
  const companyIds = companies.map((c) => c._id);
  const department = departmentMap[primaryCompany.companyCode];

  const existing = await User.findOne({ email: HR_EMAIL });
  if (existing) {
    await User.updateOne(
      { _id: existing._id },
      { $set: { accessibleCompanyIds: companyIds, employeeCode: HR_EMPLOYEE_CODE } }
    );
    dbLogger.info('HR user already exists — updated company access');
    return existing;
  }

  const hrRole = await Role.findOne({ slug: SYSTEM_ROLES.HR, isSystem: true });
  const hrDesignation = await ensureDesignation(primaryCompany._id, 'HR Administrator', ownerUser._id);

  const user = await User.create({
    employeeCode: HR_EMPLOYEE_CODE,
    firstName: 'HR',
    lastName: 'Admin',
    email: HR_EMAIL,
    password: hashedPassword,
    roleId: hrRole._id,
    companyId: primaryCompany._id,
    accessibleCompanyIds: companyIds,
    departmentId: department._id,
    designationId: hrDesignation._id,
    isActive: true,
    status: 'active',
    refreshTokenVersion: 0,
    createdBy: ownerUser._id,
    updatedBy: ownerUser._id,
  });

  await EmployeeProfile.create({
    userId: user._id,
    companyId: primaryCompany._id,
    departmentId: department._id,
    designationId: hrDesignation._id,
    employeeId: HR_EMPLOYEE_CODE,
    officialEmail: HR_EMAIL,
    joiningDate: new Date('2024-01-01'),
    employmentType: 'full_time',
    status: 'active',
    createdBy: ownerUser._id,
    updatedBy: ownerUser._id,
  });

  dbLogger.info(`Created common HR login: ${HR_EMAIL}`);
  return user;
};

const seedHrmsExcelData = async () => {
  const ownerExists = await User.findOne({ employeeCode: OWNER_CODE });
  if (ownerExists) {
    dbLogger.info('HRMS Excel data already seeded — skipping');
    return;
  }

  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });
  if (companies.length < 2) {
    throw new Error('Expected VYTALIX and FIBERISE companies before HRMS Excel seeding');
  }

  const companyMap = Object.fromEntries(companies.map((c) => [c.companyCode, c]));
  const companyIds = companies.map((c) => c._id);
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
  const employees = await loadExcelEmployees();

  if (!employees.length) {
    throw new Error('No employee rows found in HRMS Data.xlsx');
  }

  const departmentMap = {};
  for (const company of companies) {
    departmentMap[company.companyCode] = await ensureDepartment(company._id, null);
  }

  const ownerRow = employees.find((e) => e.empCode === OWNER_CODE);
  if (!ownerRow) throw new Error(`Owner employee ${OWNER_CODE} not found in Excel data`);

  const ownerName = splitName(ownerRow.empName);
  const ownerCompany = companyMap[ownerRow.companyCode];
  const ownerEmail = buildPlaceholderEmail(OWNER_CODE, ownerRow.companyCode);

  const { user: ownerUser } = await createEmployeeRecord({
    employeeCode: OWNER_CODE,
    firstName: ownerName.firstName,
    lastName: ownerName.lastName,
    email: ownerEmail,
    roleSlug: SYSTEM_ROLES.OWNER,
    companyId: ownerCompany._id,
    companyCode: ownerRow.companyCode,
    employmentType: ownerRow.employmentType,
    designationTitle: ownerRow.designation,
    workingDays: ownerRow.workingDays,
    accessibleCompanyIds: companyIds,
    actorId: null,
    hashedPassword,
    departmentId: departmentMap[ownerRow.companyCode]._id,
  });

  await Company.updateMany({}, { createdBy: ownerUser._id });
  await createHrUser({ companies, departmentMap, hashedPassword, ownerUser });

  const remaining = employees.filter((e) => e.empCode !== OWNER_CODE);
  for (const row of remaining) {
    const { firstName, lastName } = splitName(row.empName);
    const company = companyMap[row.companyCode];
    const email = buildPlaceholderEmail(row.empCode, row.companyCode);
    const roleSlug = resolveRoleSlug(row.empCode, row.designation);

    await createEmployeeRecord({
      employeeCode: row.empCode,
      firstName,
      lastName,
      email,
      roleSlug,
      companyId: company._id,
      companyCode: row.companyCode,
      employmentType: row.employmentType,
      designationTitle: row.designation,
      workingDays: row.workingDays,
      managerId: row.companyCode === 'FIBERISE' ? ownerUser._id : null,
      actorId: ownerUser._id,
      hashedPassword,
      departmentId: departmentMap[row.companyCode]._id,
    });
  }

  dbLogger.info('HRMS Excel data seeded successfully', {
    totalEmployees: employees.length,
    owner: OWNER_CODE,
    hr: HR_EMAIL,
    defaultPassword: DEFAULT_PASSWORD,
    nextFiberisePermanent: 'FR0018',
    nextVytalixPermanent: 'VMP0025',
    nextVytalixContractual: 'VMC0020',
  });
};

module.exports = {
  seedHrmsExcelData,
  DEFAULT_PASSWORD,
  HR_EMAIL,
  OWNER_CODE,
};
