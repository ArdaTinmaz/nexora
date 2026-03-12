const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, index: true },
  category: { type: String, enum: ['general', 'message'], default: 'general', index: true },
  title: { type: String, required: true, default: '' },
  message: { type: String, required: true, default: '' },
  link: { type: String, default: '/home/tasks' },
  meta: { type: Schema.Types.Mixed, default: {} },
  dedupKey: { type: String, default: '', index: true },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Number, default: null },
  createdAt: { type: Number, default: Date.now, index: true },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
