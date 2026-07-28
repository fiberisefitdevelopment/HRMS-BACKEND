const { Router } = require('express');
const policyController = require('./policy.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { updatePolicySchema } = require('./policy.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', requirePermission('leave.policy.read'), policyController.getPolicy);
router.put('/', requirePermission('leave.policy.manage'), validate(updatePolicySchema), policyController.updatePolicy);

module.exports = router;
