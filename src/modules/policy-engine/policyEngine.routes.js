const { Router } = require('express');
const controller = require('./policyEngine.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  createPolicySchema,
  updatePolicySchema,
  createRuleSchema,
  updateRuleSchema,
  testRuleSchema,
  evaluateSchema,
  idParamSchema,
  rollbackSchema,
  listQuerySchema,
} = require('./policyEngine.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/policies', requirePermission('policy.read'), validate(listQuerySchema, 'query'), controller.listPolicies);
router.post('/policies', requirePermission('policy.manage'), validate(createPolicySchema), controller.createPolicy);
router.get('/policies/:id', requirePermission('policy.read'), validate(idParamSchema, 'params'), controller.getPolicy);
router.put('/policies/:id', requirePermission('policy.manage'), validate(idParamSchema, 'params'), validate(updatePolicySchema), controller.updatePolicy);
router.put('/policies/:id/publish', requirePermission('policy.manage'), validate(idParamSchema, 'params'), controller.publishPolicy);
router.put('/policies/:id/archive', requirePermission('policy.manage'), validate(idParamSchema, 'params'), controller.archivePolicy);
router.post('/policies/:id/clone', requirePermission('policy.manage'), validate(idParamSchema, 'params'), controller.clonePolicy);
router.put('/policies/:id/rollback', requirePermission('policy.manage'), validate(idParamSchema, 'params'), validate(rollbackSchema), controller.rollbackPolicy);

router.get('/rules', requirePermission('policy.rule.read'), validate(listQuerySchema, 'query'), controller.listRules);
router.post('/rules', requirePermission('policy.rule.manage'), validate(createRuleSchema), controller.createRule);
router.get('/rules/:id', requirePermission('policy.rule.read'), validate(idParamSchema, 'params'), controller.getRule);
router.put('/rules/:id', requirePermission('policy.rule.manage'), validate(idParamSchema, 'params'), validate(updateRuleSchema), controller.updateRule);
router.put('/rules/:id/publish', requirePermission('policy.rule.manage'), validate(idParamSchema, 'params'), controller.publishRule);
router.put('/rules/:id/disable', requirePermission('policy.rule.manage'), validate(idParamSchema, 'params'), controller.disableRule);
router.post('/rules/:id/clone', requirePermission('policy.rule.manage'), validate(idParamSchema, 'params'), controller.cloneRule);

router.post('/test', requirePermission('policy.rule.test'), validate(testRuleSchema), controller.testRules);
router.post('/evaluate', requirePermission('policy.rule.evaluate'), validate(evaluateSchema), controller.evaluate);
router.get('/executions', requirePermission('policy.report'), validate(listQuerySchema, 'query'), controller.executionLogs);
router.get('/reports/:type', requirePermission('policy.report'), controller.report);

module.exports = router;
