const { Router } = require('express');
const workflowController = require('./workflow.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  createTemplateSchema,
  updateTemplateSchema,
  createLevelSchema,
  actionSchema,
  delegateSchema,
  instanceIdParam,
  templateIdParam,
  listQuerySchema,
  createConditionSchema,
  createDelegationSchema,
} = require('./workflow.validation');
const { z } = require('zod');

const router = Router();
const templateIdLevelParam = z.object({ templateId: z.string().regex(/^[a-fA-F0-9]{24}$/), levelId: z.string().regex(/^[a-fA-F0-9]{24}$/) });

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/dashboard', requirePermission('workflow.dashboard'), workflowController.getDashboard);
router.get('/pending', requirePermission('workflow.instance.approve'), workflowController.getPending);
router.get('/reports/:type', requirePermission('workflow.report'), workflowController.report);

router.get('/templates', requirePermission('workflow.template.read'), validate(listQuerySchema, 'query'), workflowController.listTemplates);
router.post('/templates', requirePermission('workflow.template.manage'), validate(createTemplateSchema), workflowController.createTemplate);
router.get('/templates/:id', requirePermission('workflow.template.read'), validate(instanceIdParam, 'params'), workflowController.getTemplate);
router.put('/templates/:id', requirePermission('workflow.template.manage'), validate(instanceIdParam, 'params'), validate(updateTemplateSchema), workflowController.updateTemplate);
router.delete('/templates/:id', requirePermission('workflow.template.manage'), validate(instanceIdParam, 'params'), workflowController.deleteTemplate);

router.post('/templates/:templateId/levels', requirePermission('workflow.template.manage'), validate(templateIdParam, 'params'), validate(createLevelSchema), workflowController.createLevel);
router.put('/templates/:templateId/levels/:levelId', requirePermission('workflow.template.manage'), validate(templateIdLevelParam, 'params'), validate(createLevelSchema.partial()), workflowController.updateLevel);
router.delete('/templates/:templateId/levels/:levelId', requirePermission('workflow.template.manage'), validate(templateIdLevelParam, 'params'), workflowController.deleteLevel);
router.post('/templates/:templateId/conditions', requirePermission('workflow.template.manage'), validate(templateIdParam, 'params'), validate(createConditionSchema), workflowController.createCondition);

router.post('/delegations', requirePermission('workflow.template.manage'), validate(createDelegationSchema), workflowController.createDelegation);

router.get('/instances', requirePermission('workflow.instance.read'), validate(listQuerySchema, 'query'), workflowController.listInstances);
router.get('/instances/:id', requirePermission('workflow.instance.read'), validate(instanceIdParam, 'params'), workflowController.getInstance);
router.get('/instances/:id/history', requirePermission('workflow.instance.read'), validate(instanceIdParam, 'params'), workflowController.getHistory);

router.put('/instances/:id/approve', requirePermission('workflow.instance.approve'), validate(instanceIdParam, 'params'), validate(actionSchema), workflowController.approve);
router.put('/instances/:id/reject', requirePermission('workflow.instance.approve'), validate(instanceIdParam, 'params'), validate(actionSchema), workflowController.reject);
router.put('/instances/:id/cancel', requirePermission('workflow.instance.read'), validate(instanceIdParam, 'params'), validate(actionSchema), workflowController.cancel);
router.put('/instances/:id/delegate', requirePermission('workflow.instance.approve'), validate(instanceIdParam, 'params'), validate(delegateSchema), workflowController.delegate);
router.put('/instances/:id/escalate', requirePermission('workflow.instance.admin'), validate(instanceIdParam, 'params'), validate(actionSchema), workflowController.escalate);

module.exports = router;
