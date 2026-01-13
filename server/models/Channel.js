const mongoose = require('mongoose');

const { Schema } = mongoose;

const channelMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
  },
  { _id: false }
);

const channelSchema = new Schema({
  name: { type: String, required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: { type: [channelMemberSchema], default: [] },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Channel', channelSchema);
