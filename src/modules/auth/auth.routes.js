const { Router } = require('express');
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  switchCompanySchema,
} = require('./auth.validation');

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.post(
  '/switch-company',
  authenticate,
  requirePermission('company.switch'),
  validate(switchCompanySchema),
  authController.switchCompany
);

module.exports = router;
