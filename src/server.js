const app = require('./app');
const config = require('./config');
const { connectDatabase, disconnectDatabase } = require('./database/connection');
const { seedDatabase } = require('./database/seeders');
const { logger } = require('./config/logger');

const startServer = async () => {
  await connectDatabase();

  if (config.seed.runOnStart || config.isDevelopment) {
    logger.info('Running startup database sync...', {
      runOnStart: config.seed.runOnStart,
      env: config.env,
    });
    await seedDatabase();
  }

  const { startAutoPunchOutJob } = require('./modules/attendance/jobs/autoPunchOut.job');
  startAutoPunchOutJob();

  const { startLeaveProcessingJobs } = require('./modules/leave/jobs/index');
  startLeaveProcessingJobs();

  require('./modules/leave/leave.workflow');
  require('./modules/comp-off/compOff.workflow');

  const { startWorkflowJobs } = require('./modules/workflow/jobs/index');
  startWorkflowJobs();

  const server = app.listen(config.server.port, () => {
    logger.info(`${config.server.appName} running on port ${config.server.port} [${config.env}]`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason: reason?.message || reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
};

startServer();
