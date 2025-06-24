const mongoose = require('mongoose');

const sessionRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480
  },
  preferredTimes: [{
    date: {
      type: Date,
      required: true
    },
    timeSlots: [{
      start: String,
      end: String
    }]
  }],
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  responseMessage: {
    type: String,
    maxlength: 500
  },
  proposedPrice: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes
sessionRequestSchema.index({ studentId: 1, createdAt: -1 });
sessionRequestSchema.index({ mentorId: 1, status: 1 });
sessionRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SessionRequest', sessionRequestSchema);