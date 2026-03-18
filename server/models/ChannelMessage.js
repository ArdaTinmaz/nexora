const mongoose = require('mongoose');

const { Schema } = mongoose;

const channelMessageSchema = new Schema({
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['user', 'system'], default: 'user', index: true },
  systemEvent: { type: String, default: '' },
  systemMeta: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Number, default: null },
});

module.exports = mongoose.model('ChannelMessage', channelMessageSchema);
