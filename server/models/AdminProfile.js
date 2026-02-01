const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminProfileSchema = new Schema({
  name: { type: String, default: 'Admin' },
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  avatarURL: { type: String, default: '' },
  resetCodeHash: { type: String, default: null },
  resetCodeExpiry: { type: Number, default: null },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('AdminProfile', adminProfileSchema);
