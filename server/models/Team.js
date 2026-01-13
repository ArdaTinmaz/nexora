const mongoose = require('mongoose');

const { Schema } = mongoose;

const teamMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['admin', 'product_manager', 'scrum_master', 'team_leader', 'developer', 'designer'],
      required: true,
    },
  },
  { _id: false }
);

const teamSchema = new Schema({
  name: { type: String, required: true },
  projectId: { type: Schema.Types.ObjectId, required: true, index: true },
  leaderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: { type: [teamMemberSchema], default: [] },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Team', teamSchema);
