const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const userService = require('./user.service');

const blockUser = catchAsync(async (req, res) => {
  const user = await userService.blockUser(req.user.id, req.body, req);
  sendSuccess(res, {
    message: 'User blocked successfully',
    data: { id: user._id, isBlocked: user.isBlocked },
  });
});

const unblockUser = catchAsync(async (req, res) => {
  const user = await userService.unblockUser(req.user.id, req.body, req);
  sendSuccess(res, {
    message: 'User activated successfully',
    data: { id: user._id, isBlocked: user.isBlocked, status: user.status },
  });
});

module.exports = {
  blockUser,
  unblockUser,
};
