const mongoose = require('mongoose');

const { Schema } = mongoose;

const projectSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  parentProjectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  endDate: { type: Number, default: null },
  createdAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Project', projectSchema);
