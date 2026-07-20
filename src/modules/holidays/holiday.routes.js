const { Router } = require('express');
const holidayController = require('./holiday.controller');
const validate = require('../../middlewares/validate.middleware');
const { optionalAuthOrPublicCompany } = require('../../middlewares/resolvePublicCompany.middleware');
const { listQuerySchema } = require('./holiday.validation');

const router = Router();

// Public — no auth required. With token: company from session.
// Without token: pass ?companyId= or ?companyCode=
router.get('/', optionalAuthOrPublicCompany, validate(listQuerySchema, 'query'), holidayController.list);

module.exports = router;
