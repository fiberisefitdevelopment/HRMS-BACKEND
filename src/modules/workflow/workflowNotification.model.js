const mongoose = require('mongoose');
const { COLLECTIONS } = require('../../constants');

const workflowNotificationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notificationType: {
      type: String,
      enum: ['approver', 'requester', 'escalated', 'delegated', 'rejected', 'approved', 'cancelled', 'reminder'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
    sentAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: COLLECTIONS.WORKFLOW_NOTIFICATIONS }
);

workflowNotificationSchema.index({ instanceId: 1, sentAt: -1 });
workflowNotificationSchema.index({ companyId: 1, userId: 1, sentAt: -1 });

module.exports = mongoose.model('WorkflowNotification', workflowNotificationSchema);
