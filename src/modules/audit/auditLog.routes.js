const { Router } = require('express');
const auditLogController = require('./auditLog.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { listQuerySchema } = require('./auditLog.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get(
  '/',
  requirePermission('audit.read'),
  validate(listQuerySchema, 'query'),
  auditLogController.list
);

module.exports = router;
