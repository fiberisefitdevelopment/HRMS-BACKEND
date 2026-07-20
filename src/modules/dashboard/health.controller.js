const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const config = require('../../config');

const getHealth = catchAsync(async (req, res) => {
  sendSuccess(res, {
    message: 'HRMS API is running',
    data: {
      name: config.server.appName,
      environment: config.env,
      version: '1.0.0',
      requestId: req.requestId,
    },
  });
});

module.exports = { getHealth };
