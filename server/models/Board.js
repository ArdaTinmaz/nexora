const mongoose = require('mongoose');

const { Schema } = mongoose;

const boardSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  icon: { type: String, default: 'project' },
  iconName: { type: String, default: 'icon-Project' },
  background: { type: String, default: '' },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Board', boardSchema);
