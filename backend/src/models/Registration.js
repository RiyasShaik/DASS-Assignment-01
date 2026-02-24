const mongoose = require('mongoose');

const merchItemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: String },
    color: { type: String },
    quantity: { type: Number, min: 1, required: true },
    unitPrice: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['normal', 'merchandise'], required: true },

    status: {
      type: String,
      enum: [
        'registered',
        'pending_approval',
        'purchase_success',
        'completed',
        'cancelled',
        'rejected',
      ],
      default: 'registered',
    },

    dynamicResponses: { type: mongoose.Schema.Types.Mixed },

    merchandiseItems: [merchItemSchema],
    totalAmount: { type: Number, min: 0, default: 0 },
    paymentProofUrl: { type: String },
    paymentStatus: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required',
    },
    paymentReviewComment: { type: String, trim: true },
    paymentReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paymentReviewedAt: { type: Date },

    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    attendanceMarked: { type: Boolean, default: false },
    attendanceAt: { type: Date },
  },
  { timestamps: true }
);

registrationSchema.index({ eventId: 1, participantId: 1 }, { unique: true });
registrationSchema.index({ organizerId: 1, status: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
