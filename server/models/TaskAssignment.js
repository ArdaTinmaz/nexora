const mongoose = require('mongoose');

const { Schema } = mongoose;

const taskAssignmentSchema = new Schema({
  cardId: { type: String, default: null, index: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['without', 'low', 'medium', 'high'], default: 'without' },
  deadline: { type: Number, default: null },
  assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, required: true, index: true },
  assignedAt: { type: Number, default: Date.now },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
});

module.exports = mongoose.model('TaskAssignment', taskAssignmentSchema);
