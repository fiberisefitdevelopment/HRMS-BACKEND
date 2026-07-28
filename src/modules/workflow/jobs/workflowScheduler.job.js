const WorkflowInstance = require('../workflowInstance.model');
const WorkflowEscalation = require('../workflowEscalation.model');
const approverResolver = require('../engines/approverResolver.engine');
const executionEngine = require('../engines/execution.engine');
const { logger } = require('../../../config/logger');

const processEscalations = async () => {
  const now = new Date();
  const pending = await WorkflowInstance.find({
    status: { $in: ['pending', 'delegated'] },
    'levelStates.dueAt': { $lte: now },
  });

  let escalated = 0;
  for (const instance of pending) {
    const levelState = instance.levelStates?.find(
      (ls) => ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending' && ls.dueAt && new Date(ls.dueAt) <= now
    );
    if (!levelState) continue;

    try {
      const escalation = await WorkflowEscalation.findOne({
        companyId: instance.companyId,
        templateId: instance.templateId,
        levelId: levelState.levelId,
        isActive: true,
      });

      let escalateToIds = [];
      if (escalation) {
        escalateToIds = await approverResolver.resolveApprovers(
          {
            approverType: escalation.escalateToApproverType,
            approverUserId: escalation.escalateToUserId,
            approverRoleId: escalation.escalateToRoleId,
          },
          { companyId: instance.companyId, employeeProfileId: instance.employeeProfileId, departmentId: instance.departmentId }
        );
      } else {
        const hrUsers = await approverResolver.getUsersByRoleSlug(instance.companyId, 'hr');
        escalateToIds = hrUsers.map((u) => u._id);
      }

      if (escalateToIds.length) {
        await executionEngine.processEscalate(instance, instance.requesterId, escalateToIds, 'Auto-escalated due to SLA breach');
        escalated += 1;
      }
    } catch (error) {
      logger.warn('Auto escalation failed', { instanceId: instance._id, error: error.message });
    }
  }

  return { escalated, checked: pending.length };
};

const processReminders = async () => {
  const pending = await WorkflowInstance.find({
    status: { $in: ['pending', 'escalated', 'delegated'] },
  });

  let sent = 0;
  for (const instance of pending) {
    const template = await require('../workflowTemplate.repository').findById(instance.templateId);
    const reminderHours = template?.config?.reminderHours || [24, 48, 72];
    const levelState = instance.levelStates?.find((ls) => ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending');
    if (!levelState?.startedAt) continue;

    const hoursWaiting = (Date.now() - new Date(levelState.startedAt).getTime()) / 3600000;
    const remindersSent = levelState.reminderSentAt?.length || 0;

    if (remindersSent < reminderHours.length && hoursWaiting >= reminderHours[remindersSent]) {
      for (const approverId of instance.currentApproverIds || []) {
        await executionEngine.sendWorkflowNotification({
          companyId: instance.companyId,
          instanceId: instance._id,
          userId: approverId,
          notificationType: 'reminder',
          title: 'Pending Approval Reminder',
          message: `Reminder: ${instance.workflowType} request awaiting your approval (${Math.round(hoursWaiting)}h)`,
          data: { entityId: instance.entityId },
        });
      }

      const levelStates = instance.levelStates.map((ls) => {
        if (ls.levelOrder === instance.currentLevelOrder) {
          return { ...ls.toObject?.() || ls, reminderSentAt: [...(ls.reminderSentAt || []), new Date()] };
        }
        return ls;
      });

      await WorkflowInstance.findByIdAndUpdate(instance._id, { levelStates, lastReminderAt: new Date(), $inc: { reminderCount: 1 } });
      sent += 1;
    }
  }

  return { sent, checked: pending.length };
};

module.exports = { processEscalations, processReminders };
