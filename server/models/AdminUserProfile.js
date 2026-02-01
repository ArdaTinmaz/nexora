const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminUserProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  role: { type: String, default: 'developer' },
  languages: { type: [String], default: [] },
  experienceYears: { type: Number, default: 0 },
  skills: { type: [String], default: [] },
  status: { type: String, enum: ['Active', 'Passive'], default: 'Active' },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('AdminUserProfile', adminUserProfileSchema);
