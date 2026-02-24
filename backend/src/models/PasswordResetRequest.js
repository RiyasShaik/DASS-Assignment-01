const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema(
  {
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminComment: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

passwordResetRequestSchema.index({ organizerId: 1, status: 1 });

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
