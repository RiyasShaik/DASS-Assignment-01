const { stringify } = require('csv-stringify/sync');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const AttendanceLog = require('../models/AttendanceLog');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { issueTicketForRegistration, refreshEventMetrics } = require('../services/registration.service');
const { postEventToDiscord } = require('../services/discord.service');

const assertOrganizerOwnsEvent = async (organizerId, eventId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new ApiError(404, 'Event not found');
  if (String(event.organizerId) !== String(organizerId)) {
    throw new ApiError(403, 'You can access only your own events');
  }
  return event;
};

const validateTimeline = ({ registrationDeadline, startDate, endDate }) => {
  if (!registrationDeadline) {
    throw new ApiError(400, 'Registration deadline is required');
  }
  if (!startDate) {
    throw new ApiError(400, 'Event start date is required');
  }
  if (!endDate) {
    throw new ApiError(400, 'Event end date is required');
  }

  const deadlineTs = new Date(registrationDeadline).getTime();
  const startTs = new Date(startDate).getTime();
  const endTs = new Date(endDate).getTime();

  if (Number.isNaN(deadlineTs)) {
    throw new ApiError(400, 'Registration deadline is not a valid date');
  }
  if (Number.isNaN(startTs)) {
    throw new ApiError(400, 'Event start date is not a valid date');
  }
  if (Number.isNaN(endTs)) {
    throw new ApiError(400, 'Event end date is not a valid date');
  }
  if (startTs > endTs) {
    throw new ApiError(400, 'Event start date must be before end date');
  }
  if (deadlineTs > startTs) {
    throw new ApiError(400, 'Registration deadline cannot be after event start date');
  }
};

const ALLOWED_CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'dropdown',
  'checkbox',
  'radio',
  'file',
  'date',
];

const OPTION_FIELD_TYPES = new Set(['dropdown', 'checkbox', 'radio']);
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCustomFormFields = (fields = []) => {
  if (!Array.isArray(fields)) {
    throw new ApiError(400, 'customFormFields must be an array');
  }

  const seenFieldIds = new Set();
  const normalized = fields.map((field, index) => {
    const fieldId = String(field.fieldId || '').trim();
    const label = String(field.label || '').trim();
    const type = String(field.type || '').trim();
    const required = Boolean(field.required);
    const order = Number.isFinite(Number(field.order)) ? Number(field.order) : index;

    if (!fieldId) {
      throw new ApiError(400, `customFormFields[${index}] is missing fieldId`);
    }
    if (!label) {
      throw new ApiError(400, `customFormFields[${index}] is missing label`);
    }
    if (!ALLOWED_CUSTOM_FIELD_TYPES.includes(type)) {
      throw new ApiError(400, `customFormFields[${index}] has invalid type`);
    }
    if (seenFieldIds.has(fieldId)) {
      throw new ApiError(400, `Duplicate custom form fieldId: ${fieldId}`);
    }
    seenFieldIds.add(fieldId);

    const options = Array.isArray(field.options)
      ? field.options.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];

    if (OPTION_FIELD_TYPES.has(type) && options.length === 0) {
      throw new ApiError(400, `Field "${label}" requires at least one option`);
    }

    return {
      fieldId,
      label,
      type,
      required,
      order,
      options,
    };
  });

  return normalized
    .sort((a, b) => a.order - b.order)
    .map((field, index) => ({
      ...field,
      order: index,
      options: OPTION_FIELD_TYPES.has(field.type) ? field.options : [],
    }));
};

const normalizeMerchandiseDetails = (details) => {
  if (!details) return { variants: [], purchaseLimitPerParticipant: 1 };

  const variants = Array.isArray(details.variants) ? details.variants : [];
  const normalizedVariants = variants.map((v, idx) => {
    const sku = String(v.sku || '').trim();
    const name = String(v.name || '').trim();
    if (!sku) throw new ApiError(400, `Merchandise variant at index ${idx} requires an SKU`);
    if (!name) throw new ApiError(400, `Merchandise variant at index ${idx} requires a name`);

    const price = Number(v.price);
    const stock = Number(v.stock);
    if (Number.isNaN(price) || price < 0) throw new ApiError(400, `Variant ${sku} requires a valid positive price`);
    if (Number.isNaN(stock) || stock < 0) throw new ApiError(400, `Variant ${sku} requires a valid positive stock`);

    return {
      sku,
      name,
      size: String(v.size || '').trim(),
      color: String(v.color || '').trim(),
      price,
      stock,
    };
  });

  const seenSkus = new Set();
  for (const v of normalizedVariants) {
    if (seenSkus.has(v.sku)) throw new ApiError(400, `Duplicate Merchandise SKU: ${v.sku}`);
    seenSkus.add(v.sku);
  }

  const limit = Number(details.purchaseLimitPerParticipant);
  return {
    variants: normalizedVariants,
    purchaseLimitPerParticipant: Number.isNaN(limit) || limit < 1 ? 1 : limit,
  };
};

const getDashboard = asyncHandler(async (req, res) => {
  const organizerId = req.user._id;
  const events = await Event.find({ organizerId }).sort({ createdAt: -1 }).lean();

  const completedEventIds = events.filter((e) => e.status === 'completed').map((e) => e._id);
  const stats = await Registration.aggregate([
    { $match: { eventId: { $in: completedEventIds } } },
    {
      $group: {
        _id: '$eventId',
        registrations: { $sum: 1 },
        sales: {
          $sum: {
            $cond: [{ $eq: ['$status', 'purchase_success'] }, 1, 0],
          },
        },
        revenue: { $sum: '$totalAmount' },
        attendance: {
          $sum: {
            $cond: ['$attendanceMarked', 1, 0],
          },
        },
      },
    },
  ]);

  const statByEvent = new Map(stats.map((s) => [String(s._id), s]));
  const eventAnalytics = events
    .filter((e) => e.status === 'completed')
    .map((e) => ({
      eventId: e._id,
      name: e.name,
      type: e.type,
      ...statByEvent.get(String(e._id)),
    }));

  res.json(
    new ApiResponse('Organizer dashboard fetched', {
      events,
      eventAnalytics,
    })
  );
});

const getProfile = asyncHandler(async (req, res) => {
  const profile = await User.findById(req.user._id)
    .select('email organizerName category description contactEmail contactNumber discordWebhook')
    .lean();
  res.json(new ApiResponse('Organizer profile fetched', profile));
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['organizerName', 'category', 'description', 'contactEmail', 'contactNumber', 'discordWebhook'];
  const updates = {};

  allowed.forEach((key) => {
    if (key in req.body) updates[key] = req.body[key];
  });

  const profile = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  })
    .select('email organizerName category description contactEmail contactNumber discordWebhook')
    .lean();

  res.json(new ApiResponse('Organizer profile updated', profile));
});

const createEvent = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    organizerId: req.user._id,
    status: 'draft',
  };

  if (!payload.name || !payload.description || !payload.type) {
    throw new ApiError(400, 'Event name, description, and type are required');
  }

  if (!['normal', 'merchandise'].includes(payload.type)) {
    throw new ApiError(400, 'Event type must be normal or merchandise');
  }

  if (payload.type === 'normal') {
    payload.customFormFields = normalizeCustomFormFields(payload.customFormFields || []);
    payload.merchandiseDetails = { variants: [], purchaseLimitPerParticipant: 1 };
  } else {
    payload.customFormFields = [];
    payload.merchandiseDetails = normalizeMerchandiseDetails(payload.merchandiseDetails);
  }

  // Coerce registrationLimit and registrationFee to numbers safely
  if (payload.registrationLimit !== undefined) {
    const limit = Number(payload.registrationLimit);
    payload.registrationLimit = Number.isNaN(limit) ? 100 : limit;
  }
  if (payload.registrationFee !== undefined) {
    const fee = Number(payload.registrationFee);
    payload.registrationFee = Number.isNaN(fee) ? 0 : fee;
  }

  validateTimeline(payload);

  const event = await Event.create(payload);
  res.status(201).json(new ApiResponse('Event draft created', event));
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const registrationsCount = await Registration.countDocuments({ eventId: event._id });
  const rawUpdates = req.body;

  if (event.status === 'draft') {
    // Whitelist allowed fields to prevent mass-assignment attacks
    const draftAllowed = [
      'name', 'description', 'type', 'category', 'venue', 'eligibility',
      'registrationDeadline', 'startDate', 'endDate', 'registrationLimit',
      'registrationFee', 'tags', 'customFormFields', 'merchandiseDetails',
    ];
    const updates = {};
    draftAllowed.forEach((key) => {
      if (key in rawUpdates) updates[key] = rawUpdates[key];
    });

    if (registrationsCount > 0 && 'customFormFields' in updates) {
      throw new ApiError(400, 'Custom form is locked after first registration');
    }

    const nextType = updates.type || event.type;
    if (nextType === 'normal' && 'customFormFields' in updates) {
      updates.customFormFields = normalizeCustomFormFields(updates.customFormFields || []);
    }
    if (nextType === 'normal') {
      updates.merchandiseDetails = { variants: [], purchaseLimitPerParticipant: 1 };
    }

    if (nextType !== 'normal' && 'customFormFields' in updates) {
      updates.customFormFields = [];
    }
    if (nextType === 'merchandise' && 'merchandiseDetails' in updates) {
      updates.merchandiseDetails = normalizeMerchandiseDetails(updates.merchandiseDetails);
    }

    Object.assign(event, updates);
    validateTimeline(event);
    await event.save();
    res.json(new ApiResponse('Draft event updated', event));
    return;
  }

  // For non-draft statuses, each branch has its own allowlist so rawUpdates is safe
  const updates = rawUpdates;

  if (event.status === 'published') {
    const allowed = ['description', 'registrationDeadline', 'registrationLimit', 'status'];
    const blocked = Object.keys(updates).filter((k) => !allowed.includes(k));
    if (blocked.length > 0) {
      throw new ApiError(400, `Cannot edit fields in published state: ${blocked.join(', ')}`);
    }

    if ('registrationLimit' in updates && Number(updates.registrationLimit) < event.registrationLimit) {
      throw new ApiError(400, 'Published event limit can only be increased');
    }

    if (
      'registrationDeadline' in updates &&
      new Date(updates.registrationDeadline).getTime() < new Date(event.registrationDeadline).getTime()
    ) {
      throw new ApiError(400, 'Published event deadline can only be extended');
    }

    if ('status' in updates && updates.status !== 'closed' && updates.status !== 'published') {
      throw new ApiError(400, 'Published event status can be set only to closed');
    }

    Object.assign(event, updates);
    validateTimeline(event);
    await event.save();
    res.json(new ApiResponse('Published event updated', event));
    return;
  }

  if (['ongoing', 'completed', 'closed'].includes(event.status)) {
    const allowed = ['status'];
    const blocked = Object.keys(updates).filter((k) => !allowed.includes(k));
    if (blocked.length > 0) {
      throw new ApiError(400, `No edits allowed for ${event.status} events except status change`);
    }

    let allowedTransitions = [];
    if (event.status === 'ongoing') {
      allowedTransitions = ['ongoing', 'completed', 'closed'];
    } else if (event.status === 'completed') {
      allowedTransitions = ['completed', 'closed'];
    } else {
      allowedTransitions = ['closed'];
    }

    if (!allowedTransitions.includes(updates.status)) {
      throw new ApiError(400, `Invalid status transition from ${event.status} to ${updates.status}`);
    }

    event.status = updates.status;
    await event.save();
    res.json(new ApiResponse('Event status updated', event));
    return;
  }

  throw new ApiError(400, 'Unsupported event state');
});

const publishEvent = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  if (event.status !== 'draft') {
    throw new ApiError(400, 'Only draft events can be published');
  }

  const requiredFields = [
    'name',
    'description',
    'type',
    'registrationDeadline',
    'startDate',
    'endDate',
    'registrationLimit',
  ];

  const missing = requiredFields.filter((f) => !event[f]);
  if (missing.length > 0) {
    throw new ApiError(400, `Cannot publish event. Missing: ${missing.join(', ')}`);
  }

  if (event.type === 'merchandise') {
    if (!event.merchandiseDetails?.variants?.length) {
      throw new ApiError(400, 'Merchandise events require at least one item variant');
    }
  }

  if (event.type === 'normal') {
    event.customFormFields = normalizeCustomFormFields(event.customFormFields || []);
  }

  event.status = 'published';
  await event.save();

  try {
    await postEventToDiscord({ organizerId: req.user._id, event });
  } catch (error) {
    console.error('[DISCORD_WEBHOOK_ERROR]', error.message);
  }

  res.json(new ApiResponse('Event published successfully', event));
});

const getEventDetails = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const { search, status, paymentStatus } = req.query;

  const participantMatch = { eventId: event._id };
  if (status) participantMatch.status = status;
  if (paymentStatus) participantMatch.paymentStatus = paymentStatus;

  const participants = await Registration.find(participantMatch)
    .populate('participantId', 'firstName lastName email')
    .populate('ticketId', 'ticketId')
    .sort({ createdAt: -1 })
    .lean();

  const searchPattern = search ? new RegExp(escapeRegExp(search), 'i') : null;

  const filtered = searchPattern
    ? participants.filter((p) => {
      const name = `${p.participantId?.firstName || ''} ${p.participantId?.lastName || ''}`.trim();
      const email = p.participantId?.email || '';
      return searchPattern.test(name) || searchPattern.test(email);
    })
    : participants;

  const analytics = {
    registrations: participants.length,
    attendance: participants.filter((p) => p.attendanceMarked).length,
    completedTeams: 0,
    revenue: participants.reduce((acc, cur) => acc + (cur.totalAmount || 0), 0),
    sales: participants.filter((p) => p.status === 'purchase_success').length,
  };

  res.json(
    new ApiResponse('Organizer event details fetched', {
      event,
      analytics,
      participants: filtered,
    })
  );
});

const exportParticipantsCsv = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const participants = await Registration.find({ eventId: event._id })
    .populate('participantId', 'firstName lastName email')
    .populate('ticketId', 'ticketId')
    .lean();

  const rows = participants.map((p) => ({
    eventName: event.name,
    participantName: `${p.participantId?.firstName || ''} ${p.participantId?.lastName || ''}`.trim(),
    email: p.participantId?.email || '',
    registrationDate: p.createdAt,
    paymentStatus: p.paymentStatus,
    registrationStatus: p.status,
    attendance: p.attendanceMarked ? 'Present' : 'Absent',
    ticketId: p.ticketId?.ticketId || '',
  }));

  const csv = stringify(rows, { header: true });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="participants-${event._id}.csv"`);
  res.send(csv);
});

const reviewMerchPayment = asyncHandler(async (req, res) => {
  const { eventId, registrationId } = req.params;
  const { decision, comment } = req.body;

  const event = await assertOrganizerOwnsEvent(req.user._id, eventId);

  if (event.type !== 'merchandise') {
    throw new ApiError(400, 'Payment approvals apply only to merchandise events');
  }

  const registration = await Registration.findOne({ _id: registrationId, eventId });
  if (!registration) throw new ApiError(404, 'Order not found');

  if (registration.paymentStatus !== 'pending' || registration.status !== 'pending_approval') {
    throw new ApiError(400, 'Only pending orders can be reviewed');
  }

  if (!['approved', 'rejected'].includes(decision)) {
    throw new ApiError(400, 'Decision must be approved/rejected');
  }

  if (decision === 'approved') {
    // Atomic stock check and decrement per variant with manual rollback
    const decrementedItems = [];
    try {
      for (const item of registration.merchandiseItems) {
        const updated = await Event.updateOne(
          {
            _id: event._id,
            'merchandiseDetails.variants.sku': item.sku,
            'merchandiseDetails.variants.stock': { $gte: item.quantity },
          },
          {
            $inc: {
              'merchandiseDetails.variants.$.stock': -item.quantity,
            },
          }
        );

        if (updated.modifiedCount === 0) {
          throw new ApiError(400, `Insufficient stock while approving SKU ${item.sku}`);
        }

        decrementedItems.push(item);
      }
    } catch (err) {
      // Manual Rollback
      for (const item of decrementedItems) {
        await Event.updateOne(
          {
            _id: event._id,
            'merchandiseDetails.variants.sku': item.sku,
          },
          {
            $inc: {
              'merchandiseDetails.variants.$.stock': item.quantity,
            },
          }
        );
      }
      throw err;
    }

    registration.paymentStatus = 'approved';
    registration.status = 'purchase_success';
    registration.paymentReviewComment = comment || '';
    registration.paymentReviewedBy = req.user._id;
    registration.paymentReviewedAt = new Date();
    await registration.save();

    const ticket = await issueTicketForRegistration(registration);
    await refreshEventMetrics(eventId);

    res.json(
      new ApiResponse('Payment approved and ticket issued', {
        registration,
        ticket,
      })
    );
    return;
  }

  registration.paymentStatus = 'rejected';
  registration.status = 'rejected';
  registration.paymentReviewComment = comment || '';
  registration.paymentReviewedBy = req.user._id;
  registration.paymentReviewedAt = new Date();
  await registration.save();
  await refreshEventMetrics(eventId);

  res.json(new ApiResponse('Payment rejected', registration));
});

const listPendingMerchOrders = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const orders = await Registration.find({
    eventId: event._id,
    type: 'merchandise',
    paymentStatus: 'pending',
  })
    .populate('participantId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .lean();

  res.json(new ApiResponse('Pending merchandise orders fetched', orders));
});

const scanTicket = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { ticketCode, method = 'manual' } = req.body;

  await assertOrganizerOwnsEvent(req.user._id, eventId);

  const ticket = await Ticket.findOne({ ticketId: ticketCode, eventId });

  if (!ticket) {
    await AttendanceLog.create({
      eventId,
      scannedBy: req.user._id,
      method,
      action: 'rejected',
      reason: 'Invalid ticket',
    });
    throw new ApiError(404, 'Invalid ticket for this event');
  }

  const registration = await Registration.findOne({ _id: ticket.registrationId, eventId });
  if (!registration) {
    throw new ApiError(404, 'Registration not found for ticket');
  }

  if (registration.attendanceMarked) {
    await AttendanceLog.create({
      eventId,
      participantId: registration.participantId,
      registrationId: registration._id,
      ticketId: ticket._id,
      scannedBy: req.user._id,
      method,
      action: 'duplicate',
      reason: 'Already scanned',
    });

    res.status(409).json(
      new ApiResponse('Duplicate scan detected', {
        duplicate: true,
        scannedAt: registration.attendanceAt,
      })
    );
    return;
  }

  registration.attendanceMarked = true;
  registration.attendanceAt = new Date();
  if (registration.status === 'registered') registration.status = 'completed';
  await registration.save();

  await Event.findByIdAndUpdate(eventId, { $inc: { totalAttendance: 1 } });

  await AttendanceLog.create({
    eventId,
    participantId: registration.participantId,
    registrationId: registration._id,
    ticketId: ticket._id,
    scannedBy: req.user._id,
    method,
    action: 'marked',
  });

  res.json(
    new ApiResponse('Attendance marked', {
      registrationId: registration._id,
      participantId: registration.participantId,
      attendanceAt: registration.attendanceAt,
    })
  );
});

const manualAttendanceOverride = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { registrationId, reason } = req.body;

  await assertOrganizerOwnsEvent(req.user._id, eventId);

  const registration = await Registration.findOne({ _id: registrationId, eventId });
  if (!registration) {
    throw new ApiError(404, 'Registration not found');
  }

  if (!registration.attendanceMarked) {
    registration.attendanceMarked = true;
    registration.attendanceAt = new Date();
    if (registration.status === 'registered') registration.status = 'completed';
    await registration.save();
    await Event.findByIdAndUpdate(eventId, { $inc: { totalAttendance: 1 } });
  }

  await AttendanceLog.create({
    eventId,
    participantId: registration.participantId,
    registrationId: registration._id,
    scannedBy: req.user._id,
    method: 'manual',
    action: 'override',
    reason: reason || 'Manual override',
  });

  res.json(new ApiResponse('Manual attendance override recorded', registration));
});

const getAttendanceDashboard = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const registrations = await Registration.find({
    eventId: event._id,
    status: { $in: ['registered', 'purchase_success', 'completed'] },
  })
    .populate('participantId', 'firstName lastName email')
    .populate('ticketId', 'ticketId')
    .lean();

  const scanned = registrations.filter((r) => r.attendanceMarked);
  const notScanned = registrations.filter((r) => !r.attendanceMarked);

  res.json(
    new ApiResponse('Attendance dashboard fetched', {
      scannedCount: scanned.length,
      notScannedCount: notScanned.length,
      scanned,
      notScanned,
    })
  );
});

const exportAttendanceCsv = asyncHandler(async (req, res) => {
  const event = await assertOrganizerOwnsEvent(req.user._id, req.params.eventId);

  const registrations = await Registration.find({ eventId: event._id })
    .populate('participantId', 'firstName lastName email')
    .populate('ticketId', 'ticketId')
    .lean();

  const rows = registrations.map((r) => ({
    participantName: `${r.participantId?.firstName || ''} ${r.participantId?.lastName || ''}`.trim(),
    email: r.participantId?.email,
    ticketId: r.ticketId?.ticketId || '',
    attendance: r.attendanceMarked ? 'Present' : 'Absent',
    attendanceAt: r.attendanceAt || '',
    status: r.status,
  }));

  const csv = stringify(rows, { header: true });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${event._id}.csv"`);
  res.send(csv);
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason || String(reason).trim().length < 5) {
    throw new ApiError(400, 'Reason is required (min 5 chars)');
  }

  const existingPending = await PasswordResetRequest.findOne({
    organizerId: req.user._id,
    status: 'pending',
  });

  if (existingPending) {
    throw new ApiError(409, 'You already have a pending password reset request');
  }

  const requestDoc = await PasswordResetRequest.create({
    organizerId: req.user._id,
    reason: String(reason).trim(),
    status: 'pending',
  });

  res.status(201).json(new ApiResponse('Password reset request submitted', requestDoc));
});

const myPasswordResetRequests = asyncHandler(async (req, res) => {
  const requests = await PasswordResetRequest.find({ organizerId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json(new ApiResponse('Password reset requests fetched', requests));
});

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  createEvent,
  updateEvent,
  publishEvent,
  getEventDetails,
  exportParticipantsCsv,
  reviewMerchPayment,
  listPendingMerchOrders,
  scanTicket,
  manualAttendanceOverride,
  getAttendanceDashboard,
  exportAttendanceCsv,
  requestPasswordReset,
  myPasswordResetRequests,
};
