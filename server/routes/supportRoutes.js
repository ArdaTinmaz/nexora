const express = require('express');
const { sendHelpRequest } = require('../controllers/supportController');

const router = express.Router();

router.post('/help', sendHelpRequest);

module.exports = router;
