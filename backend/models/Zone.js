const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    k: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    flag: {
      type: String,
      default: '🍦',
      trim: true,
    },
    short: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    desc: {
      type: String,
      default: '',
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Zone', zoneSchema);
