const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, unique: true, required: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true },
    qrPayload: { type: String, required: true },
    qrDataUrl: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    emailedAt: { type: Date },
  },
  { timestamps: true }
);

ticketSchema.index({ eventId: 1, participantId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
