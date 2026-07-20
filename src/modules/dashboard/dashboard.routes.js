const { Router } = require('express');
const { getHealth } = require('./health.controller');

const router = Router();

router.get('/health', getHealth);

module.exports = router;
