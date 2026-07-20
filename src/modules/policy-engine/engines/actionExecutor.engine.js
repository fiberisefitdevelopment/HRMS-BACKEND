const { createAuditLog } = require('../../../helpers/audit');
const { createNotification } = require('../../../helpers/notification');
const { logger } = require('../../../config/logger');

const actionHandlers = new Map();

const registerActionHandler = (actionType, handler) => {
  actionHandlers.set(actionType, handler);
};

const defaultHandlers = {
  allow: async () => ({ success: true, output: { allowed: true } }),
  block: async (params) => ({ success: true, output: { blocked: true, reason: params?.reason } }),
  approve: async (params) => ({ success: true, output: { approved: true, ...params } }),
  reject: async (params) => ({ success: true, output: { rejected: true, ...params } }),
  auto_approve: async (params) => ({ success: true, output: { autoApproved: true, ...params } }),
  auto_reject: async (params) => ({ success: true, output: { autoRejected: true, ...params } }),
  generate_warning: async (params, ctx) => ({
    success: true,
    output: { warning: params?.message || 'Rule warning triggered', ...params },
    warnings: [params?.message || 'Rule warning'],
  }),
  generate_notification: async (params, ctx) => {
    if (!ctx.dryRun && ctx.companyId && ctx.userId) {
      await createNotification({
        companyId: ctx.companyId,
        userId: ctx.userId,
        type: params?.type || 'warning',
        title: params?.title || 'Policy Notification',
        message: params?.message || 'A policy rule was triggered',
        data: params?.data || {},
      });
    }
    return { success: true, output: { notified: true } };
  },
  set_status: async (params) => {
    const output = { status: params?.status, field: params?.field };
    if (params?.field) output[params.field] = params.status;
    return { success: true, output };
  },
  convert_to_lop: async () => ({ success: true, output: { convertedToLop: true } }),
  credit_leave: async (params) => ({
    success: true,
    output: { creditLeave: true, leaveTypeCode: params?.leaveTypeCode, amount: params?.amount },
  }),
  create_audit_log: async (params, ctx) => {
    if (!ctx.dryRun) {
      await createAuditLog({
        companyId: ctx.companyId,
        userId: ctx.triggeredBy,
        action: 'rule_evaluate',
        entityType: params?.entityType || 'rule',
        entityId: ctx.ruleId,
        metadata: params?.metadata || ctx.context,
      });
    }
    return { success: true, output: { auditLogged: true } };
  },
  trigger_workflow: async (params) => ({
    success: true,
    output: { triggerWorkflow: true, workflowType: params?.workflowType },
  }),
  trigger_attendance_update: async (params) => ({
    success: true,
    output: { attendanceStatus: params?.status, ...params },
  }),
  trigger_payroll_update: async (params) => ({
    success: true,
    output: { payrollUpdate: true, ...params },
  }),
};

const executeAction = async (action, ctx) => {
  const handler = actionHandlers.get(action.actionType) || defaultHandlers[action.actionType];
  if (!handler) {
    logger.warn('Unknown rule action type', { actionType: action.actionType });
    return { success: false, error: `Unknown action: ${action.actionType}` };
  }

  try {
    const result = await handler(action.params || {}, { ...ctx, action });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const executeActions = async (actions, ctx) => {
  const results = [];
  let blocked = false;

  for (const action of actions.sort((a, b) => a.order - b.order)) {
    const result = await executeAction(action, ctx);
    results.push({ actionType: action.actionType, ...result });

    if (action.actionType === 'block' && result.success) {
      blocked = true;
      if (ctx.stopOnFailure) break;
    }
    if (!result.success && ctx.stopOnFailure && !ctx.continueOnFailure) break;
  }

  return { results, blocked };
};

module.exports = { registerActionHandler, executeAction, executeActions, defaultHandlers };
