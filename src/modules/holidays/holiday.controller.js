const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const holidayService = require('./holiday.service');

const list = catchAsync(async (req, res) => {
  const data = await holidayService.listHolidays(req.companyId, req.query);
  sendSuccess(res, { message: 'Holidays list retrieved successfully', data });
});

module.exports = { list };
