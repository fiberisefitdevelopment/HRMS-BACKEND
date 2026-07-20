const policyEngineFacade = require('../policyEngine.facade');

const applyAttendanceRules = async ({ companyId, userId, employeeProfileId, context, triggeredBy, dryRun = false }) => {
  const result = await policyEngineFacade.evaluate({
    companyId,
    ruleType: 'attendance',
    context,
    userId,
    employeeProfileId,
    triggeredBy,
    dryRun,
    module: 'attendance',
  });

  if (result.blocked) {
    const blockResult = result.ruleResults.find((r) => r.blocked);
    return { blocked: true, reason: blockResult?.outputs?.reason, result };
  }

  const statusOutput = result.outputs?.attendanceStatus || result.outputs?.status;
  return { blocked: false, attendanceStatus: statusOutput, outputs: result.outputs, result };
};

const applyLeaveRules = async ({ companyId, userId, employeeProfileId, context, triggeredBy, dryRun = false }) => {
  const result = await policyEngineFacade.evaluate({
    companyId,
    ruleType: 'leave',
    context,
    userId,
    employeeProfileId,
    triggeredBy,
    dryRun,
    module: 'leave',
  });

  if (result.blocked) {
    return { blocked: true, reason: result.outputs?.reason, result };
  }

  return {
    blocked: false,
    convertToLop: result.outputs?.convertedToLop,
    triggerWorkflow: result.outputs?.triggerWorkflow,
    outputs: result.outputs,
    warnings: result.warnings,
    result,
  };
};

module.exports = { applyAttendanceRules, applyLeaveRules };
