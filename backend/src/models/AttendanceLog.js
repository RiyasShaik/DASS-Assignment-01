const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['camera', 'file', 'manual'], default: 'manual' },
    action: { type: String, enum: ['marked', 'duplicate', 'rejected', 'override'], required: true },
    reason: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

attendanceLogSchema.index({ eventId: 1, participantId: 1, timestamp: -1 });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
