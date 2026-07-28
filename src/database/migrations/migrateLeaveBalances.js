const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const { initializeLeaveBalances } = require('../../modules/leave/helpers/balanceInit.helper');
const { dbLogger } = require('../../config/logger');
const { hasMigrationRun, markMigrationRun } = require('./migrationState');

/**
 * Backfill leave balances for all active employees based on company leave policy.
 */
const migrateLeaveBalances = async () => {
  if (await hasMigrationRun('leave_balances_v1')) return;

  const profiles = await EmployeeProfile.find({ isDeleted: false, status: 'active' }).select(
    '_id userId companyId employeeId'
  );

  if (!profiles.length) {
    await markMigrationRun('leave_balances_v1');
    return;
  }

  let initialized = 0;
  let skipped = 0;

  for (const profile of profiles) {
    try {
      const result = await initializeLeaveBalances(profile, profile.userId, profile.companyId, {
        skipExisting: true,
        reason: 'Initial leave balance migration',
      });

      if (result.skipped) {
        skipped += 1;
        continue;
      }

      if (result.credited?.length) {
        initialized += 1;
        dbLogger.info('Leave balances initialized', {
          employeeId: profile.employeeId,
          companyId: profile.companyId,
          credited: result.credited,
        });
      }
    } catch (error) {
      dbLogger.warn('Leave balance init failed', {
        employeeId: profile.employeeId,
        companyId: profile.companyId,
        error: error.message,
      });
    }
  }

  if (initialized || skipped) {
    dbLogger.info(`Leave balance migration complete — initialized ${initialized}, skipped ${skipped}`);
  }

  await markMigrationRun('leave_balances_v1');
};

module.exports = { migrateLeaveBalances };
