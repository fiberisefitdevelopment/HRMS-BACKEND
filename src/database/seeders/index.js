const Permission = require('../../modules/permissions/permission.model');
const Role = require('../../modules/roles/role.model');
const Company = require('../../modules/companies/company.model');
const User = require('../../modules/users/user.model');
const { dbLogger } = require('../../config/logger');
const { SYSTEM_ROLES } = require('../../constants');
const {
  DEFAULT_PERMISSIONS,
  ROLE_DEFINITIONS,
  SEED_COMPANIES,
} = require('../../modules/auth/auth.constants');
const { syncPermissions } = require('./syncPermissions');
const { seedAttendancePolicies } = require('./seedAttendance');
const { seedGeofences } = require('./seedGeofences');
const { seedLeavePolicies } = require('./seedLeave');
const { seedHolidays } = require('./seedHolidays');
const { seedWorkflowTemplates } = require('./seedWorkflow');
const { seedPolicyEngine } = require('./seedPolicyEngine');
const { seedHrmsExcelData } = require('./seedHrmsExcelData');
const { seedManagerTestData } = require('./seedManagerTestData');
const { seedEmployeeAttendanceTestData } = require('./seedEmployeeAttendanceTestData');
const { migrateLeaveSingleApproval } = require('../migrations/migrateLeaveSingleApproval');
const { migrateEmployeeCodes } = require('../migrations/migrateEmployeeCodes');
const { migrateLeaveBalances } = require('../migrations/migrateLeaveBalances');

const seedDatabase = async () => {
  const permissionCount = await Permission.countDocuments();
  if (permissionCount > 0) {
    await syncPermissions();
    await seedAttendancePolicies();
    await seedGeofences();
    await seedLeavePolicies();
    await seedHolidays();
    await seedWorkflowTemplates();
    await seedPolicyEngine();
    await seedHrmsExcelData();
    await seedManagerTestData();
    await seedEmployeeAttendanceTestData();
    await migrateLeaveSingleApproval();
    await migrateEmployeeCodes();
    await migrateLeaveBalances();
    dbLogger.info('Database already seeded — permissions synced');
    return;
  }

  dbLogger.info('Starting database seed...');

  const permissions = await Permission.insertMany(
    DEFAULT_PERMISSIONS.map((p) => ({ ...p, isSystem: true, description: p.name }))
  );
  const permissionMap = Object.fromEntries(permissions.map((p) => [p.slug, p._id]));

  const roles = {};
  for (const roleDef of ROLE_DEFINITIONS) {
    const rolePermissions = permissions
      .filter((p) => roleDef.permissionFilter(p.slug))
      .map((p) => p._id);

    const role = await Role.create({
      name: roleDef.name,
      slug: roleDef.slug,
      companyId: null,
      description: roleDef.description,
      permissions: rolePermissions,
      isSystem: true,
      isActive: true,
      hierarchy: roleDef.hierarchy,
    });
    roles[roleDef.slug] = role;
  }

  const companies = [];
  for (const companyData of SEED_COMPANIES) {
    const company = await Company.create({
      ...companyData,
      status: 'active',
    });
    companies.push(company);
  }

  await seedAttendancePolicies();
  await seedGeofences();
  await seedLeavePolicies();
  await seedHolidays();
  await seedWorkflowTemplates();
  await seedPolicyEngine();
  await seedHrmsExcelData();
  await seedManagerTestData();
  await seedEmployeeAttendanceTestData();
  await migrateLeaveSingleApproval();
  await migrateEmployeeCodes();
  await migrateLeaveBalances();

  const owner = await User.findOne({ employeeCode: 'FR0001' });

  dbLogger.info('Database seeded successfully', {
    permissions: permissions.length,
    roles: Object.keys(roles).length,
    companies: companies.length,
    ownerEmail: owner?.email,
    ownerCode: owner?.employeeCode,
  });

  return { owner, companies, roles, permissions: permissionMap };
};

module.exports = { seedDatabase };
