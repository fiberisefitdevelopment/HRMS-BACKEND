const BaseRepository = require('../../shared/base/base.repository');
const WorkflowInstance = require('./workflowInstance.model');
const { parsePagination, parseSort, buildPaginationMeta } = require('../../utils/pagination');

class WorkflowInstanceRepository extends BaseRepository {
  constructor() {
    super(WorkflowInstance);
  }

  findByEntity(entityType, entityId, companyId) {
    return this.model.findOne({ companyId, entityType, entityId }, null, { companyId });
  }

  async findWithFilters(filter, query, options = {}) {
    const { page, limit, skip } = parsePagination(query);
    const sort = parseSort(query.sort, { createdAt: -1 });

    const [data, total] = await Promise.all([
      this.model.find(filter, null, options).sort(sort).skip(skip).limit(limit)
        .populate('requesterId', 'firstName lastName fullName email')
        .populate('templateId', 'name workflowType'),
      this.model.countDocuments(filter, options),
    ]);

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  findPendingForApprover(companyId, approverId) {
    return this.model.find(
      { companyId, status: { $in: ['pending', 'escalated', 'delegated'] }, currentApproverIds: approverId },
      null,
      { companyId }
    ).populate('requesterId', 'firstName lastName fullName email');
  }
}

module.exports = new WorkflowInstanceRepository();
