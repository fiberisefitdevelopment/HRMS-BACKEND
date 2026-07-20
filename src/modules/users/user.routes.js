const { Router } = require('express');
const userController = require('./user.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { blockUserSchema, unblockUserSchema } = require('./user.validation');

const router = Router();

router.use(authenticate, attachCompanyScope);

router.post('/block', requirePermission('user.block'), validate(blockUserSchema), userController.blockUser);
router.post(
  '/unblock',
  requirePermission('user.activate'),
  validate(unblockUserSchema),
  userController.unblockUser
);

module.exports = router;
