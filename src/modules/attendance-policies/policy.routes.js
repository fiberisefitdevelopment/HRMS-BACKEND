const { Router } = require('express');
const policyController = require('./policy.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { updatePolicySchema } = require('./policy.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', requirePermission('attendance.policy.read'), policyController.get);
router.put(
  '/',
  requirePermission('attendance.policy.manage'),
  validate(updatePolicySchema),
  policyController.update
);

module.exports = router;
