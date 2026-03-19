const mongoose = require('mongoose');

const { Schema } = mongoose;

const authAttemptSchema = new Schema({
  scope: { type: String, required: true, index: true },
  key: { type: String, required: true, index: true },
  windowStartAt: { type: Number, default: Date.now },
  failCount: { type: Number, default: 0 },
  lockUntil: { type: Number, default: null, index: true },
  lastFailureAt: { type: Number, default: null },
  lastSuccessAt: { type: Number, default: null },
  lastIp: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

authAttemptSchema.index({ scope: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('AuthAttempt', authAttemptSchema);
