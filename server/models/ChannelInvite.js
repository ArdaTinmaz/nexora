const mongoose = require('mongoose');

const { Schema } = mongoose;

const channelInviteSchema = new Schema({
  channelId: { type: Schema.Types.ObjectId, ref: 'Channel', required: true, index: true },
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('ChannelInvite', channelInviteSchema);
