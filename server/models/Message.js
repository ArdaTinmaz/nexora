const mongoose = require('mongoose');

const { Schema } = mongoose;

const messageSchema = new Schema({
  roomId: { type: String, required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: {
    type: String,
    enum: ['admin', 'product_manager', 'scrum_master', 'team_leader', 'developer', 'designer'],
    required: true,
  },
  message: { type: String, required: true },
  type: { type: String, enum: ['team', 'direct'], required: true },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);
