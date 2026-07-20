const WorkflowInstance = require('./workflowInstance.model');
const WorkflowAction = require('./workflowAction.model');

const generateReport = async (type, companyId, query) => {
  const filter = { companyId };
  if (query.workflowType) filter.workflowType = query.workflowType;
  if (query.status) filter.status = query.status;

  switch (type) {
    case 'pending': {
      filter.status = { $in: ['pending', 'escalated', 'delegated'] };
      const pending = await WorkflowInstance.find(filter, null, { companyId })
        .populate('requesterId', 'firstName lastName fullName')
        .sort({ createdAt: -1 });
      return {
        type,
        data: pending.map((i) => ({
          id: i._id,
          workflowType: i.workflowType,
          entityType: i.entityType,
          entityId: i.entityId,
          requester: i.requesterId?.fullName,
          status: i.status,
          currentLevel: i.currentLevelOrder,
          waitingSince: i.startedAt,
        })),
      };
    }

    case 'rejected': {
      filter.status = 'rejected';
      const rejected = await WorkflowInstance.find(filter, null, { companyId }).sort({ completedAt: -1 });
      return { type, data: rejected };
    }

    case 'escalated': {
      filter.status = 'escalated';
      const escalated = await WorkflowInstance.find(filter, null, { companyId }).sort({ updatedAt: -1 });
      return { type, data: escalated };
    }

    case 'sla': {
      const pending = await WorkflowInstance.find(
        { companyId, status: { $in: ['pending', 'escalated'] } },
        null,
        { companyId }
      );
      const now = Date.now();
      return {
        type,
        data: pending.map((i) => {
          const levelState = i.levelStates?.find((ls) => ls.levelOrder === i.currentLevelOrder);
          const hoursWaiting = levelState?.startedAt
            ? Math.round((now - new Date(levelState.startedAt).getTime()) / 3600000)
            : 0;
          return {
            id: i._id,
            workflowType: i.workflowType,
            hoursWaiting,
            dueAt: levelState?.dueAt,
            overdue: levelState?.dueAt ? new Date(levelState.dueAt) < new Date() : false,
          };
        }),
      };
    }

    case 'analytics': {
      const [total, completed, rejected, pending] = await Promise.all([
        WorkflowInstance.countDocuments({ companyId }),
        WorkflowInstance.countDocuments({ companyId, status: 'completed' }),
        WorkflowInstance.countDocuments({ companyId, status: 'rejected' }),
        WorkflowInstance.countDocuments({ companyId, status: { $in: ['pending', 'escalated', 'delegated'] } }),
      ]);
      const actions = await WorkflowAction.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]);
      return {
        type,
        data: { total, completed, rejected, pending, actions },
      };
    }

    case 'approval_time': {
      const completed = await WorkflowInstance.find(
        { companyId, status: 'completed', completedAt: { $exists: true } },
        null,
        { companyId }
      ).limit(100);
      return {
        type,
        data: completed.map((i) => ({
          id: i._id,
          workflowType: i.workflowType,
          hoursToComplete: Math.round((new Date(i.completedAt) - new Date(i.startedAt)) / 3600000),
        })),
      };
    }

    default:
      return { type, data: [] };
  }
};

module.exports = { generateReport };
