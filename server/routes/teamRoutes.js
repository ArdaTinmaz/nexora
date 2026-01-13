const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getMyTeams } = require('../controllers/teamController');

const router = express.Router();

router.use(authMiddleware);
router.get('/my', getMyTeams);

module.exports = router;
