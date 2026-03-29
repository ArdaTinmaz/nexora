const express = require('express');
const { sendHelpRequest } = require('../controllers/supportController');
const { createEndpointRateLimiter } = require('../security/endpointRateLimit');

const router = express.Router();

const supportHelpRateLimiter = createEndpointRateLimiter({
  scope: 'support:help',
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.SUPPORT_HELP_RATE_LIMIT_PER_MINUTE) || 5,
});

router.post('/help', supportHelpRateLimiter, sendHelpRequest);

module.exports = router;
