const mongoose = require('mongoose');

const { Schema } = mongoose;

const cardSchema = new Schema({
  columnId: { type: Schema.Types.ObjectId, ref: 'BoardColumn', required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['without', 'low', 'medium', 'high'],
    default: 'without',
  },
  deadline: { type: String, default: null },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('Card', cardSchema);
