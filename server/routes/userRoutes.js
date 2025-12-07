const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  requestEmailChange,
  verifyEmailChange,
} = require('../controllers/userController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\\-_]/g, '');
    cb(null, `${unique}-${sanitized}`);
  },
});

const upload = multer({ storage });

router.use(authMiddleware);

router.get('/me', getProfile);
router.patch('/me', upload.single('avatar'), updateProfile);
router.post('/me/email/request', requestEmailChange);
router.post('/me/email/verify', verifyEmailChange);

module.exports = router;
