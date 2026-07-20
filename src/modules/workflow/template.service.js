const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const templateRepository = require('./workflowTemplate.repository');
const levelRepository = require('./workflowLevel.repository');
const WorkflowCondition = require('./workflowCondition.model');
const WorkflowEscalation = require('./workflowEscalation.model');

const formatTemplate = (t) => ({
  id: t._id,
  companyId: t.companyId,
  name: t.name,
  workflowType: t.workflowType,
  description: t.description,
  version: t.version,
  isDefault: t.isDefault,
  status: t.status,
  config: t.config,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const createTemplate = async (data, companyId, actorId, req) => {
  const template = await templateRepository.create({
    ...data,
    companyId,
    createdBy: actorId,
    updatedBy: actorId,
  });

  if (data.levels?.length) {
    for (const level of data.levels) {
      await levelRepository.create({ ...level, templateId: template._id, companyId });
    }
  }

  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'workflow_template', entityId: template._id, req });
  return formatTemplate(template);
};

const updateTemplate = async (id, data, companyId, actorId, req) => {
  const template = await templateRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!template) throw ApiError.notFound('Workflow template not found');

  const updated = await templateRepository.updateById(id, { ...data, updatedBy: actorId }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'workflow_template', entityId: id, req });
  return formatTemplate(updated);
};

const deleteTemplate = async (id, companyId, actorId, req) => {
  const template = await templateRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!template) throw ApiError.notFound('Workflow template not found');
  await templateRepository.updateById(id, { status: 'inactive' }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'delete', entityType: 'workflow_template', entityId: id, req });
};

const getTemplate = async (id, companyId) => {
  const template = await templateRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!template) throw ApiError.notFound('Workflow template not found');
  const levels = await levelRepository.findByTemplate(id, companyId);
  const conditions = await WorkflowCondition.find({ templateId: id, companyId }, null, { companyId });
  const escalations = await WorkflowEscalation.find({ templateId: id, companyId }, null, { companyId });
  return { ...formatTemplate(template), levels, conditions, escalations };
};

const listTemplates = async (companyId, query) => {
  const filter = { companyId };
  if (query.workflowType) filter.workflowType = query.workflowType;
  if (query.status) filter.status = query.status;
  const result = await templateRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatTemplate), meta: result.meta };
};

const createLevel = async (templateId, data, companyId, actorId, req) => {
  const template = await templateRepository.findOne({ _id: templateId, companyId }, null, { companyId });
  if (!template) throw ApiError.notFound('Workflow template not found');
  const level = await levelRepository.create({ ...data, templateId, companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'workflow_level', entityId: level._id, req });
  return level;
};

const updateLevel = async (levelId, data, companyId, actorId, req) => {
  const level = await levelRepository.updateById(levelId, data, { companyId });
  if (!level) throw ApiError.notFound('Workflow level not found');
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'workflow_level', entityId: levelId, req });
  return level;
};

const deleteLevel = async (levelId, companyId, actorId, req) => {
  await levelRepository.updateById(levelId, { status: 'inactive' }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'delete', entityType: 'workflow_level', entityId: levelId, req });
};

const createCondition = async (templateId, data, companyId, actorId, req) => {
  const condition = await WorkflowCondition.create({ ...data, templateId, companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'workflow_condition', entityId: condition._id, req });
  return condition;
};

const createEscalation = async (templateId, data, companyId, actorId, req) => {
  const escalation = await WorkflowEscalation.create({ ...data, templateId, companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'workflow_escalation', entityId: escalation._id, req });
  return escalation;
};

const createDelegation = async (data, companyId, actorId, req) => {
  const WorkflowDelegation = require('./workflowDelegation.model');
  const delegation = await WorkflowDelegation.create({ ...data, companyId, createdBy: actorId });
  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'workflow_delegation', entityId: delegation._id, req });
  return delegation;
};

module.exports = {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  createLevel,
  updateLevel,
  deleteLevel,
  createCondition,
  createEscalation,
  createDelegation,
};
