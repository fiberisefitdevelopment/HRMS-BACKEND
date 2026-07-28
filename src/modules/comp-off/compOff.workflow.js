/**
 * Legacy workflow callbacks for old pending comp-off instances.
 * New raises use native PUT /comp-off/:id/approve|reject — no workflow.
 */
const { registerWorkflowCallback } = require('../workflow/registry/moduleCallback.registry');
const compOffRequestRepository = require('./compOffRequest.repository');
const { creditOnApproval } = require('./compOff.service');

const syncStatus = async (entityId, companyId, status, extra = {}) => {
  await compOffRequestRepository.updateById(
    entityId,
    { status, ...extra, updatedAt: new Date() },
    { companyId }
  );
};

registerWorkflowCallback('comp_off', {
  onApproved: async ({ entityId, companyId, actorId }) => {
    const request = await compOffRequestRepository.findOne({ _id: entityId, companyId }, null, {
      companyId,
    });
    if (!request || request.status === 'approved') return;

    await syncStatus(entityId, companyId, 'approved', {
      approvedAt: new Date(),
      approvedBy: actorId,
      updatedBy: actorId,
    });

    const updated = await compOffRequestRepository.findById(entityId, null, { companyId });
    await creditOnApproval(updated, actorId);
  },

  onRejected: async ({ entityId, companyId, actorId, comment }) => {
    const request = await compOffRequestRepository.findOne({ _id: entityId, companyId }, null, {
      companyId,
    });
    if (!request || request.status !== 'pending') return;

    await syncStatus(entityId, companyId, 'rejected', {
      rejectedBy: actorId,
      rejectedReason: comment,
      updatedBy: actorId,
    });
  },

  onCancelled: async ({ entityId, companyId, actorId, comment }) => {
    const request = await compOffRequestRepository.findOne({ _id: entityId, companyId }, null, {
      companyId,
    });
    if (!request || request.status === 'cancelled') return;

    await syncStatus(entityId, companyId, 'cancelled', {
      cancelledAt: new Date(),
      cancelledReason: comment,
      updatedBy: actorId,
    });
  },

  onCompleted: async () => {},
});
