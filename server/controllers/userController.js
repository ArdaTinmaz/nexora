const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const UserModel = require('../models/User');
const sendEmailVerificationCode = require('../utils/sendEmailVerificationCode');

const buildUserResponse = (userDoc) => ({
  id: userDoc.id,
  name: userDoc.name,
  email: userDoc.email,
  avatarURL: userDoc.avatarURL,
  theme: userDoc.theme,
});

const normalizeEmail = (email) =>
  validator.normalizeEmail(email, {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  }) || email.toLowerCase();

const ensureUploadsDir = () => {
  const uploadPath = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await UserModel.findUserById(req.user.id);
    res.json({ user: buildUserResponse(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const updates = {};

    if (name && name.trim()) {
      updates.name = name.trim();
    }

    if (password) {
      if (!validator.isStrongPassword(password, { minNumbers: 1, minSymbols: 0 })) {
        return res.status(400).json({
          message:
            'Şifre en az 8 karakter olmalı, en az bir rakam ve en az bir büyük harf içermelidir',
        });
      }
      updates.password = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      ensureUploadsDir();
      updates.avatarURL = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await UserModel.updateUserFields(req.user.id, updates);

    res.json({
      message: 'Profil güncellendi',
      user: buildUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

exports.requestEmailChange = async (req, res, next) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) {
      return res.status(400).json({ message: 'Yeni e-posta gereklidir' });
    }

    const trimmed = newEmail.trim();
    if (!validator.isEmail(trimmed)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta giriniz' });
    }

    const normalizedEmail = normalizeEmail(trimmed);
    const currentUser = await UserModel.findUserById(req.user.id);

    if (currentUser.email === normalizedEmail) {
      return res.status(400).json({ message: 'E-posta zaten bu adres' });
    }

    const existing = await UserModel.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: 'Bu e-posta ile kayıtlı kullanıcı var' });
    }

    const code = (Math.floor(100000 + Math.random() * 900000)).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiry = Date.now() + 15 * 60 * 1000; // 15dk

    await UserModel.setPendingEmail(req.user.id, {
      pendingEmail: normalizedEmail,
      tokenHash: codeHash,
      expiry,
    });

    await sendEmailVerificationCode({
      to: normalizedEmail,
      name: currentUser.name,
      code,
    });

    res.json({ message: 'Doğrulama kodu yeni e-postaya gönderildi' });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmailChange = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Kod gereklidir' });
    }

    const user = await UserModel.findUserById(req.user.id);
    if (!user?.pendingEmail || !user.emailVerificationTokenHash) {
      return res.status(400).json({ message: 'Bekleyen e-posta doğrulaması yok' });
    }

    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < Date.now()) {
      await UserModel.clearPendingEmail(req.user.id);
      return res.status(400).json({ message: 'Kodun süresi doldu' });
  }

  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  if (codeHash !== user.emailVerificationTokenHash) {
    return res.status(400).json({ message: 'Invalid verification code' });
  }

    const updatedUser = await UserModel.applyPendingEmail(req.user.id);

    res.json({
      message: 'E-posta güncellendi',
      user: buildUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};
