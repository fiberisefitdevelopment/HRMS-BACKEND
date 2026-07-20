const { Router } = require('express');
const permissionController = require('./permission.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');

const router = Router();

router.get('/', authenticate, requirePermission('permission.read'), permissionController.getPermissions);

module.exports = router;
