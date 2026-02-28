const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  requestEmailChange,
  verifyEmailChange,
} = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);

router.get('/me', getProfile);
router.patch('/me', updateProfile);
router.post('/me/email/request', requestEmailChange);
router.post('/me/email/verify', verifyEmailChange);

module.exports = router;
