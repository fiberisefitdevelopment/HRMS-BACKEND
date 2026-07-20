const { Router } = require('express');
const notificationController = require('./notification.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { listQuerySchema, notificationIdParam } = require('./notification.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', validate(listQuerySchema, 'query'), notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', validate(notificationIdParam, 'params'), notificationController.markRead);

module.exports = router;
