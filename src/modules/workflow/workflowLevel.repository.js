const BaseRepository = require('../../shared/base/base.repository');
const WorkflowLevel = require('./workflowLevel.model');

class WorkflowLevelRepository extends BaseRepository {
  constructor() {
    super(WorkflowLevel);
  }

  findByTemplate(templateId, companyId) {
    return this.model.find({ templateId, companyId, status: 'active' }, null, { companyId }).sort({ levelOrder: 1 });
  }
}

module.exports = new WorkflowLevelRepository();
