const Notification = require('../modules/notifications/notification.model');
const { logger } = require('../config/logger');

const createNotification = async ({
  companyId,
  userId,
  type = 'info',
  title,
  message,
  actionUrl = null,
  data = {},
  expiresAt = null,
}) => {
  try {
    const notification = await Notification.create({
      companyId,
      userId,
      type,
      title,
      message,
      actionUrl,
      data,
      expiresAt,
    });
    return notification;
  } catch (error) {
    logger.error('Failed to create notification', { error: error.message, userId, title });
    return null;
  }
};

const notifyLeaveApplied = async (companyId, approverUserId, leaveRequest, employeeName) =>
  createNotification({
    companyId,
    userId: approverUserId,
    type: 'action_required',
    title: 'Leave Request Submitted',
    message: `${employeeName} applied for ${leaveRequest.leaveType} from ${leaveRequest.startDate} to ${leaveRequest.endDate}`,
    actionUrl: `/approvals`,
    data: { leaveRequestId: leaveRequest._id, status: 'pending' },
  });

const notifyLeaveApproved = async (companyId, userId, leaveRequest) =>
  createNotification({
    companyId,
    userId,
    type: 'success',
    title: 'Leave Approved',
    message: `Your ${leaveRequest.leaveType} request has been approved`,
    actionUrl: `/approvals`,
    data: { leaveRequestId: leaveRequest._id, status: 'approved' },
  });

const notifyLeaveRejected = async (companyId, userId, leaveRequest, reason) =>
  createNotification({
    companyId,
    userId,
    type: 'error',
    title: 'Leave Rejected',
    message: `Your ${leaveRequest.leaveType} request was rejected${reason ? `: ${reason}` : ''}`,
    actionUrl: `/approvals`,
    data: { leaveRequestId: leaveRequest._id, status: 'rejected' },
  });

const notifyLeaveCancelled = async (companyId, userId, leaveRequest) =>
  createNotification({
    companyId,
    userId,
    type: 'warning',
    title: 'Leave Cancelled',
    message: `Leave request for ${leaveRequest.leaveType} has been cancelled`,
    actionUrl: `/approvals`,
    data: { leaveRequestId: leaveRequest._id, status: 'cancelled' },
  });

const notifyBalanceUpdated = async (companyId, userId, leaveType, balance, reason) =>
  createNotification({
    companyId,
    userId,
    type: 'info',
    title: 'Leave Balance Updated',
    message: `Your ${leaveType} balance is now ${balance}. ${reason || ''}`,
    actionUrl: `/approvals`,
    data: { leaveType, balance, reason },
  });

const notifyShiftAssigned = async (companyId, userId, shift) =>
  createNotification({
    companyId,
    userId,
    type: 'info',
    title: 'Shift Assigned',
    message: `You have been assigned to ${shift.name} (${shift.startTime} – ${shift.endTime})`,
    actionUrl: `/approvals`,
    data: { shiftId: shift.id || shift._id, shiftName: shift.name },
  });

module.exports = {
  createNotification,
  notifyLeaveApplied,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyLeaveCancelled,
  notifyBalanceUpdated,
  notifyShiftAssigned,
};
