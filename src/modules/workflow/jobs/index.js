const { registerJob } = require('../../scheduler/scheduler.service');
const { processEscalations, processReminders } = require('./workflowScheduler.job');

const startWorkflowJobs = () => {
  registerJob('workflow-escalation', '0 */2 * * *', processEscalations, {
    frequency: 'daily',
    maxRetries: 3,
  });

  registerJob('workflow-reminders', '0 */6 * * *', processReminders, {
    frequency: 'daily',
    maxRetries: 3,
  });
};

module.exports = { startWorkflowJobs };
