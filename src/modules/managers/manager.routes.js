const { Router } = require('express');
const managerController = require('./manager.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { assignManagerSchema } = require('./manager.validation');
const { z } = require('zod');

const removeManagerSchema = z.object({
  employeeProfileId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.post('/assign', requirePermission('manager.assign'), validate(assignManagerSchema), managerController.assign);
router.post('/change', requirePermission('manager.assign'), validate(assignManagerSchema), managerController.change);
router.post('/remove', requirePermission('manager.assign'), validate(removeManagerSchema), managerController.remove);
router.get('/team', requirePermission('manager.read'), managerController.getTeam);
router.get('/:managerId/team', requirePermission('manager.read'), managerController.getTeam);

module.exports = router;
