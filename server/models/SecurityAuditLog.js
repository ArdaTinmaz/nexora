const mongoose = require('mongoose');

const { Schema } = mongoose;

const securityAuditLogSchema = new Schema({
  eventType: { type: String, required: true, index: true },
  category: { type: String, default: 'security', index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  outcome: { type: String, enum: ['success', 'failure', 'blocked'], default: 'success' },
  actorType: { type: String, default: 'user' },
  actorId: { type: String, default: '' },
  actorName: { type: String, default: '' },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  resource: { type: String, default: '' },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  message: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Number, default: Date.now, index: true },
});

module.exports = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
