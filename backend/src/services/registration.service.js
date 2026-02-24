const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const { generateTicketId, buildQrPayload, generateQrDataUrl } = require('./ticket.service');
const { sendTicketMail } = require('./email.service');

const issueTicketForRegistration = async (registration) => {
  if (registration.ticketId) {
    return Ticket.findById(registration.ticketId);
  }

  const [event, participant] = await Promise.all([
    Event.findById(registration.eventId),
    User.findById(registration.participantId),
  ]);

  const ticketCode = generateTicketId();
  const qrPayload = buildQrPayload({
    ticketId: ticketCode,
    eventId: String(registration.eventId),
    participantId: String(registration.participantId),
  });
  const qrDataUrl = await generateQrDataUrl(qrPayload);

  const ticket = await Ticket.create({
    ticketId: ticketCode,
    eventId: registration.eventId,
    participantId: registration.participantId,
    registrationId: registration._id,
    qrPayload,
    qrDataUrl,
    emailedAt: new Date(),
  });

  registration.ticketId = ticket._id;
  await registration.save();

  if (participant?.email && event?.name) {
    const participantName = participant.firstName
      ? `${participant.firstName} ${participant.lastName || ''}`.trim()
      : participant.email;

    await sendTicketMail({
      to: participant.email,
      participantName,
      eventName: event.name,
      ticketId: ticket.ticketId,
    });
  }

  return ticket;
};

const refreshEventMetrics = async (eventId) => {
  const oid = new mongoose.Types.ObjectId(eventId);
  const [totalRegistrations, revenueAgg, successPurchases] = await Promise.all([
    Registration.countDocuments({
      eventId: oid,
      status: { $in: ['registered', 'purchase_success', 'completed'] },
    }),
    Registration.aggregate([
      { $match: { eventId: oid, status: { $in: ['purchase_success', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Registration.countDocuments({ eventId: oid, status: 'purchase_success' }),
  ]);

  await Event.findByIdAndUpdate(eventId, {
    totalRegistrations,
    totalSales: successPurchases,
    totalRevenue: revenueAgg[0]?.total || 0,
  });
};

module.exports = {
  issueTicketForRegistration,
  refreshEventMetrics,
};
