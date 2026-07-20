const BaseRepository = require('../../shared/base/base.repository');
const WorkflowTemplate = require('./workflowTemplate.model');

class WorkflowTemplateRepository extends BaseRepository {
  constructor() {
    super(WorkflowTemplate);
  }

  findDefault(companyId, workflowType) {
    return this.model.findOne({ companyId, workflowType, isDefault: true, status: 'active' }, null, { companyId });
  }

  findActive(companyId, workflowType) {
    return this.model.findOne({ companyId, workflowType, status: 'active' }, null, { companyId });
  }
}

module.exports = new WorkflowTemplateRepository();
