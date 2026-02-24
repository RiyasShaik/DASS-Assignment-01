const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isPast } = require('../utils/date');
const { issueTicketForRegistration, refreshEventMetrics } = require('../services/registration.service');

const validateEligibility = (participantType, eventEligibility) => {
  if (eventEligibility === 'all') return true;
  return participantType === eventEligibility;
};

const ensureParticipant = async (participantId) => {
  const participant = await User.findById(participantId);
  if (!participant || participant.role !== 'participant') {
    throw new ApiError(404, 'Participant not found');
  }
  return participant;
};

const getDashboard = asyncHandler(async (req, res) => {
  const participantId = req.user._id;

  const registrations = await Registration.find({ participantId })
    .populate({
      path: 'eventId',
      populate: { path: 'organizerId', select: 'organizerName category' },
    })
    .populate('ticketId')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();

  const upcoming = registrations.filter((r) => r.eventId && new Date(r.eventId.startDate) >= now);

  const history = {
    normal: registrations.filter((r) => r.type === 'normal'),
    merchandise: registrations.filter((r) => r.type === 'merchandise'),
    completed: registrations.filter((r) => ['completed', 'purchase_success'].includes(r.status)),
    cancelledRejected: registrations.filter((r) => ['cancelled', 'rejected'].includes(r.status)),
  };

  res.json(new ApiResponse('Participant dashboard fetched', { upcoming, history }));
});

const getProfile = asyncHandler(async (req, res) => {
  const participant = await User.findById(req.user._id)
    .populate('followedOrganizers', 'organizerName category description contactEmail')
    .lean();

  res.json(new ApiResponse('Profile fetched', participant));
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['firstName', 'lastName', 'contactNumber', 'collegeName', 'interests'];
  const updates = {};

  allowed.forEach((key) => {
    if (key in req.body) {
      updates[key] = req.body[key];
    }
  });

  const participant = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  })
    .populate('followedOrganizers', 'organizerName category description contactEmail')
    .lean();

  res.json(new ApiResponse('Profile updated', participant));
});

const updatePreferences = asyncHandler(async (req, res) => {
  const { interests = [], followedOrganizers = [] } = req.body;

  const organizers = await User.find({
    _id: { $in: followedOrganizers },
    role: 'organizer',
    isDisabled: false,
    isArchived: false,
  }).select('_id');

  const participant = await User.findByIdAndUpdate(
    req.user._id,
    {
      interests: Array.isArray(interests) ? interests : [],
      followedOrganizers: organizers.map((o) => o._id),
    },
    { new: true }
  )
    .populate('followedOrganizers', 'organizerName category description contactEmail')
    .lean();

  res.json(new ApiResponse('Preferences updated', participant));
});

const followOrganizer = asyncHandler(async (req, res) => {
  const organizerId = req.params.organizerId;

  const organizer = await User.findOne({
    _id: organizerId,
    role: 'organizer',
    isDisabled: false,
    isArchived: false,
  }).lean();

  if (!organizer) {
    throw new ApiError(404, 'Organizer not found');
  }

  const participant = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { followedOrganizers: organizerId } },
    { new: true }
  )
    .populate('followedOrganizers', 'organizerName category description contactEmail')
    .lean();

  res.json(new ApiResponse('Organizer followed', participant));
});

const unfollowOrganizer = asyncHandler(async (req, res) => {
  const participant = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { followedOrganizers: req.params.organizerId } },
    { new: true }
  )
    .populate('followedOrganizers', 'organizerName category description contactEmail')
    .lean();

  res.json(new ApiResponse('Organizer unfollowed', participant));
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DYNAMIC_FILE_FIELD_PREFIX = 'dynamicFile__';

const hasValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const normalizeOptionValues = (options = []) =>
  (Array.isArray(options) ? options : [])
    .map((option) => String(option || '').trim())
    .filter(Boolean);

const parseDynamicResponses = (raw) => {
  if (raw === undefined || raw === null || raw === '') return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      throw new ApiError(400, 'Invalid dynamicResponses payload JSON');
    }
    throw new ApiError(400, 'dynamicResponses must be a JSON object');
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }

  throw new ApiError(400, 'dynamicResponses must be an object');
};

const attachUploadedFilesToResponses = (responses, files = []) => {
  if (!Array.isArray(files)) return;

  files.forEach((file) => {
    const fieldName = String(file.fieldname || '');
    if (!fieldName.startsWith(DYNAMIC_FILE_FIELD_PREFIX)) return;

    const fieldId = fieldName.substring(DYNAMIC_FILE_FIELD_PREFIX.length).trim();
    if (!fieldId) return;

    const filePath = `/uploads/form-responses/${file.filename}`;
    const existing = responses[fieldId];

    if (!existing) {
      responses[fieldId] = filePath;
      return;
    }

    if (Array.isArray(existing)) {
      existing.push(filePath);
      responses[fieldId] = existing;
      return;
    }

    responses[fieldId] = [existing, filePath];
  });
};

const validateCustomForm = (event, responses = {}) => {
  const errors = [];

  (event.customFormFields || []).forEach((field) => {
    const fieldId = String(field.fieldId || '').trim();
    if (!fieldId) return;

    const value = responses[fieldId];
    const options = normalizeOptionValues(field.options);
    const missing = !hasValue(value);

    if (field.required && missing) {
      errors.push(`Missing required field: ${field.label}`);
      return;
    }

    if (missing) return;

    switch (field.type) {
      case 'text':
      case 'textarea': {
        if (typeof value !== 'string') {
          errors.push(`Invalid value for field: ${field.label}`);
          return;
        }
        responses[fieldId] = value.trim();
        break;
      }
      case 'email': {
        if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) {
          errors.push(`Invalid email value for field: ${field.label}`);
          return;
        }
        responses[fieldId] = value.trim().toLowerCase();
        break;
      }
      case 'number': {
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
          errors.push(`Invalid numeric value for field: ${field.label}`);
          return;
        }
        responses[fieldId] = numberValue;
        break;
      }
      case 'date': {
        if (Number.isNaN(new Date(value).getTime())) {
          errors.push(`Invalid date value for field: ${field.label}`);
        }
        break;
      }
      case 'dropdown':
      case 'radio': {
        const selected = String(value).trim();
        if (!selected) {
          if (field.required) {
            errors.push(`Missing required field: ${field.label}`);
          }
          return;
        }

        if (options.length > 0 && !options.includes(selected)) {
          errors.push(`Invalid selection for field: ${field.label}`);
          return;
        }
        responses[fieldId] = selected;
        break;
      }
      case 'checkbox': {
        const selectedValues = Array.isArray(value) ? value : [value];
        const normalized = selectedValues
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);

        if (field.required && normalized.length === 0) {
          errors.push(`Missing required field: ${field.label}`);
          return;
        }

        if (options.length > 0 && normalized.some((entry) => !options.includes(entry))) {
          errors.push(`Invalid selection for field: ${field.label}`);
          return;
        }

        responses[fieldId] = normalized;
        break;
      }
      case 'file': {
        const valid =
          typeof value === 'string' ||
          (Array.isArray(value) && value.every((entry) => typeof entry === 'string'));
        if (!valid) {
          errors.push(`Invalid file response for field: ${field.label}`);
          return;
        }
        break;
      }
      default:
        errors.push(`Unsupported field type for: ${field.label}`);
    }
  });
  return errors;
};

const registerNormalEvent = asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const participant = await ensureParticipant(req.user._id);
  const event = await Event.findById(eventId);

  if (!event) throw new ApiError(404, 'Event not found');
  if (event.type !== 'normal') throw new ApiError(400, 'This endpoint is only for normal events');
  if (!['published', 'ongoing'].includes(event.status)) throw new ApiError(400, 'Registrations are closed for this event');
  if (isPast(event.registrationDeadline)) throw new ApiError(400, 'Registration deadline has passed');
  if (!validateEligibility(participant.participantType, event.eligibility)) {
    throw new ApiError(403, 'You are not eligible for this event');
  }

  const existing = await Registration.findOne({ eventId, participantId: req.user._id });
  if (existing) throw new ApiError(409, 'You are already registered for this event');

  const approvedCount = await Registration.countDocuments({
    eventId,
    status: { $in: ['registered', 'purchase_success', 'completed'] },
  });

  if (approvedCount >= event.registrationLimit) {
    throw new ApiError(400, 'Registration limit reached');
  }

  const dynamicResponses = parseDynamicResponses(req.body.dynamicResponses);
  attachUploadedFilesToResponses(dynamicResponses, req.files || []);

  const formErrors = validateCustomForm(event, dynamicResponses);
  if (formErrors.length > 0) {
    throw new ApiError(400, 'Custom form validation failed', formErrors);
  }

  const registration = await Registration.create({
    eventId,
    participantId: req.user._id,
    organizerId: event.organizerId,
    type: 'normal',
    status: 'registered',
    dynamicResponses,
    totalAmount: event.registrationFee,
    paymentStatus: event.registrationFee > 0 ? 'approved' : 'not_required',
  });

  const ticket = await issueTicketForRegistration(registration);
  await refreshEventMetrics(eventId);

  res.status(201).json(new ApiResponse('Event registration successful', { registration, ticket }));
});

const createMerchOrder = asyncHandler(async (req, res) => {
  const eventId = req.params.eventId;
  const participant = await ensureParticipant(req.user._id);
  const event = await Event.findById(eventId);

  if (!event) throw new ApiError(404, 'Event not found');
  if (event.type !== 'merchandise') throw new ApiError(400, 'This endpoint is only for merchandise events');
  if (!['published', 'ongoing'].includes(event.status)) throw new ApiError(400, 'Purchases are closed for this event');
  if (isPast(event.registrationDeadline)) throw new ApiError(400, 'Purchase deadline has passed');
  if (!validateEligibility(participant.participantType, event.eligibility)) {
    throw new ApiError(403, 'You are not eligible for this merchandise event');
  }

  if (!req.file) {
    throw new ApiError(400, 'Payment proof file is required');
  }

  const existing = await Registration.findOne({ eventId, participantId: req.user._id });
  if (existing && existing.status !== 'rejected') {
    throw new ApiError(409, 'You already have an active order for this event');
  }

  let rawItems = req.body.items;
  if (typeof req.body.items === 'string') {
    try {
      rawItems = JSON.parse(req.body.items);
    } catch (error) {
      throw new ApiError(400, 'Invalid items payload JSON');
    }
  }

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new ApiError(400, 'At least one merchandise item is required');
  }

  const variantMap = new Map((event.merchandiseDetails?.variants || []).map((v) => [v.sku, v]));
  const items = [];
  let totalQty = 0;
  let totalAmount = 0;

  rawItems.forEach((item) => {
    const variant = variantMap.get(item.sku);
    if (!variant) throw new ApiError(400, `Invalid merchandise SKU: ${item.sku}`);

    const quantity = Number(item.quantity || 0);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ApiError(400, `Invalid quantity for SKU ${item.sku}`);
    }

    if (quantity > variant.stock) {
      throw new ApiError(400, `Requested quantity exceeds stock for SKU ${item.sku}`);
    }

    totalQty += quantity;
    totalAmount += quantity * variant.price;

    items.push({
      sku: variant.sku,
      name: variant.name,
      size: variant.size,
      color: variant.color,
      quantity,
      unitPrice: variant.price,
    });
  });

  const perParticipantLimit = event.merchandiseDetails?.purchaseLimitPerParticipant || 1;
  if (totalQty > perParticipantLimit) {
    throw new ApiError(
      400,
      `Purchase quantity cannot exceed participant limit (${perParticipantLimit})`
    );
  }

  const payload = {
    eventId,
    participantId: req.user._id,
    organizerId: event.organizerId,
    type: 'merchandise',
    status: 'pending_approval',
    merchandiseItems: items,
    totalAmount,
    paymentStatus: 'pending',
    paymentProofUrl: `/uploads/payment-proofs/${req.file.filename}`,
  };

  // If previous order was rejected, delete it to free the unique index slot
  if (existing && existing.status === 'rejected') {
    await Registration.deleteOne({ _id: existing._id });
  }
  const registration = await Registration.create(payload);

  res.status(201).json(
    new ApiResponse('Order submitted for payment approval', {
      registration,
      message: 'Order is pending organizer approval. QR/ticket will be issued only after approval.',
    })
  );
});

const getMyRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({ participantId: req.user._id })
    .populate({ path: 'eventId', populate: { path: 'organizerId', select: 'organizerName category' } })
    .populate('ticketId')
    .sort({ createdAt: -1 })
    .lean();

  res.json(new ApiResponse('Registrations fetched', registrations));
});

const getTicket = asyncHandler(async (req, res) => {
  const { ticketCode } = req.params;
  const ticket = await Ticket.findOne({ ticketId: ticketCode })
    .populate('eventId')
    .populate('participantId', 'firstName lastName email')
    .lean();

  if (!ticket) throw new ApiError(404, 'Ticket not found');

  if (req.user.role === 'participant' && String(ticket.participantId._id) !== String(req.user._id)) {
    throw new ApiError(403, 'Forbidden ticket access');
  }

  res.json(new ApiResponse('Ticket fetched', ticket));
});

module.exports = {
  getDashboard,
  getProfile,
  updateProfile,
  updatePreferences,
  followOrganizer,
  unfollowOrganizer,
  registerNormalEvent,
  createMerchOrder,
  getMyRegistrations,
  getTicket,
};
