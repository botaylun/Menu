const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    z: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    b: {
      type: String,
      default: 'Hãng khác',
      trim: true,
    },
    n: {
      type: String,
      required: true,
      trim: true,
    },
    v: {
      type: Number,
      required: true,
      min: 0,
    },
    img: {
      type: String,
      default: '',
    },
    bg: {
      type: String,
      default: '',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Item', itemSchema);
