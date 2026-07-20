const { Router } = require('express');
const roleController = require('./role.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');

const router = Router();

router.get('/', authenticate, requirePermission('role.read'), roleController.getRoles);

module.exports = router;
