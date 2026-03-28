const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  ownerName: { type: String, default: '' },
  parentProjectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  status: { type: String, enum: ['Active', 'Passive'], default: 'Active' },
  endDate: { type: Number, default: null },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Project', projectSchema);
