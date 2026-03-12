const mongoose = require('mongoose');

const { Schema } = mongoose;

const cardAssigneeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, default: '' },
    avatarURL: { type: String, default: '' },
    claimedAt: { type: Number, default: Date.now },
  },
  { _id: false }
);

const cardSchema = new Schema({
  columnId: { type: Schema.Types.ObjectId, ref: 'BoardColumn', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['without', 'low', 'medium', 'high'],
    default: 'without',
  },
  position: { type: Number, default: 0 },
  deadline: { type: String, default: null },
  completed: { type: Boolean, default: false },
  completedAt: { type: Number, default: null },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ownerName: { type: String, default: '' },
  ownerAvatarURL: { type: String, default: '' },
  assignees: { type: [cardAssigneeSchema], default: [] },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Card', cardSchema);
