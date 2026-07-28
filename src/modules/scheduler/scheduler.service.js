const cron = require('node-cron');
const JobExecutionLog = require('./jobExecutionLog.model');
const { logger } = require('../../config/logger');
const { createAuditLog } = require('../../helpers/audit');

const registeredJobs = new Map();

const executeWithRetry = async (jobName, handler, options = {}) => {
  const { maxRetries = 3, frequency = null, companyId = null, metadata = {} } = options;
  let attempt = 0;
  let lastError = null;

  const log = await JobExecutionLog.create({
    jobName,
    frequency,
    companyId,
    status: 'running',
    startedAt: new Date(),
    attempt: 1,
    maxRetries,
    metadata,
  });

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const result = await handler();
      await JobExecutionLog.findByIdAndUpdate(log._id, {
        status: 'completed',
        completedAt: new Date(),
        attempt,
        result: result || {},
      });
      await createAuditLog({
        companyId,
        action: 'scheduler_run',
        entityType: 'scheduler_job',
        entityId: log._id,
        metadata: { jobName, attempt, frequency, status: 'completed' },
      });
      return result;
    } catch (error) {
      lastError = error;
      logger.error(`Job ${jobName} failed attempt ${attempt}`, { error: error.message });
      await JobExecutionLog.findByIdAndUpdate(log._id, {
        status: attempt < maxRetries ? 'retrying' : 'failed',
        attempt,
        error: error.message,
        errorStack: error.stack,
      });
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  await JobExecutionLog.findByIdAndUpdate(log._id, {
    status: 'failed',
    completedAt: new Date(),
    attempt,
    error: lastError?.message,
    errorStack: lastError?.stack,
  });

  await createAuditLog({
    companyId,
    action: 'scheduler_run',
    entityType: 'scheduler_job',
    entityId: log._id,
    metadata: { jobName, attempt, frequency, status: 'failed', error: lastError?.message },
  });

  throw lastError;
};

const registerJob = (name, cronExpression, handler, options = {}) => {
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression for job ${name}: ${cronExpression}`);
  }

  cron.schedule(cronExpression, () => {
    executeWithRetry(name, handler, options).catch((err) => {
      logger.error(`Scheduled job ${name} failed after retries`, { error: err.message });
    });
  });

  registeredJobs.set(name, { cronExpression, frequency: options.frequency });
  logger.info(`Scheduled job registered: ${name} (${cronExpression})`);
};

const getRegisteredJobs = () => Array.from(registeredJobs.entries()).map(([name, config]) => ({ name, ...config }));

module.exports = { registerJob, executeWithRetry, getRegisteredJobs };
