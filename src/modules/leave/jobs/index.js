const { registerJob } = require('../../scheduler/scheduler.service');
const {
  runMonthlyProcessing,
  runQuarterlyProcessing,
  runHalfYearlyProcessing,
} = require('./leaveProcessing.job');

const startLeaveProcessingJobs = () => {
  // Monthly: 1st of every month at 00:30
  registerJob('monthly-leave-processing', '30 0 1 * *', runMonthlyProcessing, {
    frequency: 'monthly',
    maxRetries: 3,
  });

  // Quarterly: 1st of Jan, Apr, Jul, Oct at 01:00
  registerJob('quarterly-leave-processing', '0 1 1 1,4,7,10 *', runQuarterlyProcessing, {
    frequency: 'quarterly',
    maxRetries: 3,
  });

  // Half-yearly: 1st of Jan and Jul at 01:30
  registerJob('half-yearly-leave-processing', '30 1 1 1,7 *', runHalfYearlyProcessing, {
    frequency: 'half_yearly',
    maxRetries: 3,
  });
};

module.exports = { startLeaveProcessingJobs };
