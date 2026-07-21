const User = require('../../modules/users/user.model');
const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const { dbLogger } = require('../../config/logger');
const { hasMigrationRun, markMigrationRun } = require('./migrationState');

/**
 * Backfill User.employeeCode from EmployeeProfile.employeeId.
 * Prevents unique-index conflicts on (companyId, employeeCode) when employeeCode is null.
 */
const migrateEmployeeCodes = async () => {
  if (await hasMigrationRun('employee_codes_v1')) return;

  const users = await User.find({
    $or: [{ employeeCode: null }, { employeeCode: { $exists: false } }, { employeeCode: '' }],
  }).select('_id companyId employeeCode email');

  if (!users.length) {
    await markMigrationRun('employee_codes_v1');
    return;
  }

  let updated = 0;
  for (const user of users) {
    const profile = await EmployeeProfile.findOne({
      userId: user._id,
      companyId: user.companyId,
      isDeleted: false,
    }).select('employeeId');

    const employeeCode = profile?.employeeId || `USR${user._id.toString().slice(-6).toUpperCase()}`;

    await User.updateOne({ _id: user._id }, { $set: { employeeCode } });
    updated += 1;
    dbLogger.info(`Backfilled employeeCode for ${user.email} -> ${employeeCode}`);
  }

  if (updated) {
    dbLogger.info(`Employee code migration complete — updated ${updated} user(s)`);
  }

  await markMigrationRun('employee_codes_v1');
};

module.exports = { migrateEmployeeCodes };
