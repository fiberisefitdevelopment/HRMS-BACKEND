const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const notificationService = require('./notification.service');

const list = catchAsync(async (req, res) => {
  const { data, meta } = await notificationService.listForUser(
    req.companyId,
    req.user.id,
    req.query
  );
  sendSuccess(res, { message: 'Notifications retrieved', data, meta });
});

const unreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.companyId, req.user.id);
  sendSuccess(res, { message: 'Unread count retrieved', data: { count } });
});

const markRead = catchAsync(async (req, res) => {
  const data = await notificationService.markAsRead(req.params.id, req.companyId, req.user.id);
  sendSuccess(res, { message: 'Notification marked as read', data });
});

const markAllRead = catchAsync(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.companyId, req.user.id);
  sendSuccess(res, { message: 'All notifications marked as read', data });
});

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
};
