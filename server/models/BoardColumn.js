const mongoose = require('mongoose');

const { Schema } = mongoose;

const boardColumnSchema = new Schema({
  boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
  title: { type: String, required: true },
  position: { type: Number, default: 0 },
  createdAt: { type: Number, default: Date.now },
  updatedAt: { type: Number, default: Date.now },
});

module.exports = mongoose.model('BoardColumn', boardColumnSchema);
