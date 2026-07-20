const ApiError = require('../../utils/ApiError');
const notificationRepository = require('./notification.repository');

const formatNotification = (notification) => ({
  id: notification._id,
  companyId: notification.companyId,
  userId: notification.userId,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  isRead: notification.isRead,
  readAt: notification.readAt,
  actionUrl: notification.actionUrl,
  data: notification.data,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
});

const listForUser = async (companyId, userId, query = {}) => {
  const filter = { companyId, userId };
  if (query.unreadOnly) filter.isRead = false;

  const result = await notificationRepository.findMany(filter, query, { companyId });
  return {
    data: result.data.map(formatNotification),
    meta: result.meta,
  };
};

const getUnreadCount = async (companyId, userId) => {
  const count = await notificationRepository.model.countDocuments({
    companyId,
    userId,
    isRead: false,
  });
  return count;
};

const markAsRead = async (id, companyId, userId) => {
  const notification = await notificationRepository.findOne({ _id: id, companyId, userId }, null, {
    companyId,
  });
  if (!notification) throw ApiError.notFound('Notification not found');

  if (notification.isRead) return formatNotification(notification);

  const updated = await notificationRepository.updateById(
    id,
    { isRead: true, readAt: new Date() },
    { companyId }
  );
  return formatNotification(updated);
};

const markAllAsRead = async (companyId, userId) => {
  await notificationRepository.model.updateMany(
    { companyId, userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return { updated: true };
};

module.exports = {
  listForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  formatNotification,
};
