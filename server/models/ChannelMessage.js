const mongoose = require('mongoose');

const { Schema } = mongoose;

const channelMessageSchema = new Schema({
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('ChannelMessage', channelMessageSchema);
