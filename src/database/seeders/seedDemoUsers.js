const Company = require('../../modules/companies/company.model');
const Department = require('../../modules/departments/department.model');
const Designation = require('../../modules/designations/designation.model');
const User = require('../../modules/users/user.model');
const Role = require('../../modules/roles/role.model');
const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const Shift = require('../../modules/shifts/shift.model');
const EmployeeShiftAssignment = require('../../modules/shifts/employeeShiftAssignment.model');
const { hashPassword } = require('../../helpers/password');
const { generateEmployeeId } = require('../../modules/employees/employeeId.generator');
const { dbLogger } = require('../../config/logger');
const { SYSTEM_ROLES, LEAVE_TYPES } = require('../../constants');
const LeaveBalance = require('../../modules/leave/leaveBalance.model');
const CompanyLeavePolicy = require('../../modules/leave-policies/companyLeavePolicy.model');
const ledgerEngine = require('../../modules/leave/engines/ledger.engine');

const DEMO_HR_EMAIL = 'hr@hrms.local';
const DEMO_PASSWORDS = {
  hr: 'Hr@12345',
  manager: 'Manager@12345',
  employee: 'Employee@12345',
};

const ensureOrgStructure = async (companyId) => {
  let department = await Department.findOne({ companyId, code: 'HR' }, null, { companyId });
  if (!department) {
    department = await Department.create({
      companyId,
      name: 'Human Resources',
      code: 'HR',
      description: 'HR department',
      status: 'active',
    });
  }

  let designation = await Designation.findOne({ companyId, code: 'GEN' }, null, { companyId });
  if (!designation) {
    designation = await Designation.create({
      companyId,
      name: 'General Staff',
      code: 'GEN',
      level: 1,
      status: 'active',
    });
  }

  return { department, designation };
};

const getDefaultShift = async (companyId) => {
  const shift = await Shift.findOne({ companyId, code: 'GENERAL', status: 'active' }, null, { companyId });
  return shift || Shift.findOne({ companyId, status: 'active' }, null, { companyId });
};

const assignShiftIfNeeded = async (employeeProfileId, userId, companyId, shiftId, actorId) => {
  if (!shiftId) return;

  const existing = await EmployeeShiftAssignment.findOne(
    { companyId, employeeProfileId, isActive: true },
    null,
    { companyId }
  );
  if (existing) return;

  await EmployeeShiftAssignment.create({
    companyId,
    employeeProfileId,
    userId,
    shiftId,
    effectiveFrom: new Date(),
    isActive: true,
    assignedBy: actorId,
  });
};

const createDemoUser = async ({
  email,
  password,
  firstName,
  lastName,
  roleSlug,
  companyId,
  departmentId,
  designationId,
  managerId = null,
  accessibleCompanyIds = null,
  actorId = null,
}) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    dbLogger.info(`Demo user already exists — skipping ${email}`);
    return { user: existing, profile: await EmployeeProfile.findOne({ userId: existing._id, companyId }) };
  }

  const role = await Role.findOne({ slug: roleSlug, isSystem: true });
  if (!role) throw new Error(`Role ${roleSlug} not found`);

  const hashedPassword = await hashPassword(password);
  const employeeId = await generateEmployeeId(companyId);

  const user = await User.create({
    employeeCode: employeeId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone: '9876543210',
    password: hashedPassword,
    roleId: role._id,
    companyId,
    accessibleCompanyIds: accessibleCompanyIds || [companyId],
    departmentId,
    designationId,
    managerId,
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
    designationId,
    managerId,
    employeeId,
    officialEmail: email.toLowerCase(),
    phone: '9876543210',
    joiningDate: new Date('2024-01-15'),
    employmentType: 'full_time',
    status: 'active',
    createdBy: actorId,
    updatedBy: actorId,
  });

  return { user, profile };
};

const ensureDemoLeaveBalances = async (profile, userId, companyId) => {
  if (!profile?._id) return;

  const existing = await LeaveBalance.countDocuments({ companyId, employeeProfileId: profile._id });
  if (existing > 0) return;

  const policy = await CompanyLeavePolicy.findOne({ companyId, isDefault: true, status: 'active' }, null, {
    companyId,
  });
  if (!policy) return;

  for (const leaveType of policy.leaveTypes) {
    if (!leaveType.isActive || leaveType.code === 'LOP') continue;

    let amount = leaveType.creditAmount;
    if (leaveType.code === 'SL') {
      amount = policy.shortLeave?.monthlyAllowance ?? 1;
    } else if (amount > 0) {
      amount *= 2;
    }

    if (amount <= 0) continue;

    await ledgerEngine.creditLeave({
      companyId,
      employeeProfileId: profile._id,
      userId,
      leaveType: leaveType.leaveType || LEAVE_TYPES[leaveType.code],
      leaveTypeCode: leaveType.code,
      amount,
      reason: 'Demo account initial leave balance',
      referenceType: 'system',
      referenceId: null,
      createdBy: null,
    });
  }

  dbLogger.info('Seeded demo leave balances', { employeeId: profile.employeeId, companyId });
};

const seedDemoUsers = async () => {
  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });
  if (companies.length < 2) {
    dbLogger.warn('Expected VYTALIX and FIBERISE companies for demo user seeding');
    return;
  }

  const owner = await User.findOne({ email: 'owner@hrms.local' });
  const actorId = owner?._id || null;
  const companyIds = companies.map((c) => c._id);
  const vytalix = companies.find((c) => c.companyCode === 'VYTALIX');
  const fiberise = companies.find((c) => c.companyCode === 'FIBERISE');

  const vytalixOrg = await ensureOrgStructure(vytalix._id);
  const fiberiseOrg = await ensureOrgStructure(fiberise._id);

  const vytalixShift = await getDefaultShift(vytalix._id);
  const fiberiseShift = await getDefaultShift(fiberise._id);

  const { user: hrUser, profile: hrProfile } = await createDemoUser({
    email: DEMO_HR_EMAIL,
    password: DEMO_PASSWORDS.hr,
    firstName: 'HR',
    lastName: 'Admin',
    roleSlug: SYSTEM_ROLES.HR,
    companyId: vytalix._id,
    departmentId: vytalixOrg.department._id,
    designationId: vytalixOrg.designation._id,
    accessibleCompanyIds: companyIds,
    actorId,
  });

  if (hrUser && companyIds.length > 1) {
    await User.updateOne(
      { _id: hrUser._id },
      { $set: { accessibleCompanyIds: companyIds } }
    );
  }

  const { user: vytalixManager, profile: vytalixManagerProfile } = await createDemoUser({
    email: 'manager.vytalix@hrms.local',
    password: DEMO_PASSWORDS.manager,
    firstName: 'Vytalix',
    lastName: 'Manager',
    roleSlug: SYSTEM_ROLES.MANAGER,
    companyId: vytalix._id,
    departmentId: vytalixOrg.department._id,
    designationId: vytalixOrg.designation._id,
    actorId,
  });

  const { user: fiberiseManager, profile: fiberiseManagerProfile } = await createDemoUser({
    email: 'manager.fiberise@hrms.local',
    password: DEMO_PASSWORDS.manager,
    firstName: 'Fiberise',
    lastName: 'Manager',
    roleSlug: SYSTEM_ROLES.MANAGER,
    companyId: fiberise._id,
    departmentId: fiberiseOrg.department._id,
    designationId: fiberiseOrg.designation._id,
    actorId,
  });

  const { user: vytalixEmployee, profile: vytalixEmployeeProfile } = await createDemoUser({
    email: 'employee.vytalix@hrms.local',
    password: DEMO_PASSWORDS.employee,
    firstName: 'Vytalix',
    lastName: 'Employee',
    roleSlug: SYSTEM_ROLES.EMPLOYEE,
    companyId: vytalix._id,
    departmentId: vytalixOrg.department._id,
    designationId: vytalixOrg.designation._id,
    managerId: vytalixManager._id,
    actorId,
  });

  const { user: fiberiseEmployee, profile: fiberiseEmployeeProfile } = await createDemoUser({
    email: 'employee.fiberise@hrms.local',
    password: DEMO_PASSWORDS.employee,
    firstName: 'Fiberise',
    lastName: 'Employee',
    roleSlug: SYSTEM_ROLES.EMPLOYEE,
    companyId: fiberise._id,
    departmentId: fiberiseOrg.department._id,
    designationId: fiberiseOrg.designation._id,
    managerId: fiberiseManager._id,
    actorId,
  });

  await assignShiftIfNeeded(hrProfile._id, hrUser._id, vytalix._id, vytalixShift?._id, actorId);
  await assignShiftIfNeeded(vytalixManagerProfile._id, vytalixManager._id, vytalix._id, vytalixShift?._id, actorId);
  await assignShiftIfNeeded(fiberiseManagerProfile._id, fiberiseManager._id, fiberise._id, fiberiseShift?._id, actorId);
  await assignShiftIfNeeded(vytalixEmployeeProfile._id, vytalixEmployee._id, vytalix._id, vytalixShift?._id, actorId);
  await assignShiftIfNeeded(
    fiberiseEmployeeProfile._id,
    fiberiseEmployee._id,
    fiberise._id,
    fiberiseShift?._id,
    actorId
  );

  const demoProfiles = [
    { profile: vytalixManagerProfile, userId: vytalixManager._id, companyId: vytalix._id },
    { profile: fiberiseManagerProfile, userId: fiberiseManager._id, companyId: fiberise._id },
    { profile: vytalixEmployeeProfile, userId: vytalixEmployee._id, companyId: vytalix._id },
    { profile: fiberiseEmployeeProfile, userId: fiberiseEmployee._id, companyId: fiberise._id },
  ];

  for (const { profile, userId, companyId } of demoProfiles) {
    await ensureDemoLeaveBalances(profile, userId, companyId);
  }

  dbLogger.info('Demo users seeded successfully', {
    hr: DEMO_HR_EMAIL,
    managers: ['manager.vytalix@hrms.local', 'manager.fiberise@hrms.local'],
    employees: ['employee.vytalix@hrms.local', 'employee.fiberise@hrms.local'],
  });
};

module.exports = { seedDemoUsers, DEMO_HR_EMAIL, DEMO_PASSWORDS };
