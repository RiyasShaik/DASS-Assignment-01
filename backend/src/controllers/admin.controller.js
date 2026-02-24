const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const AttendanceLog = require('../models/AttendanceLog');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const generateStrongPassword = require('../utils/generatePassword');

const toSlug = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'organizer';

const generateOrganizerEmail = async (organizerName) => {
  const base = `${toSlug(organizerName)}@felicity.local`;
  if (!(await User.exists({ email: base }))) return base;

  let suffix = 1;
  while (suffix < 10000) {
    const candidate = `${toSlug(organizerName)}-${suffix}@felicity.local`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await User.exists({ email: candidate }))) return candidate;
    suffix += 1;
  }

  throw new ApiError(500, 'Failed to generate unique organizer email');
};

const getDashboard = asyncHandler(async (_req, res) => {
  const [participants, organizers, events, registrations, pendingResetRequests] = await Promise.all([
    User.countDocuments({ role: 'participant' }),
    User.countDocuments({ role: 'organizer' }),
    Event.countDocuments({}),
    Registration.countDocuments({}),
    PasswordResetRequest.countDocuments({ status: 'pending' }),
  ]);

  res.json(
    new ApiResponse('Admin dashboard fetched', {
      participants,
      organizers,
      events,
      registrations,
      pendingResetRequests,
    })
  );
});

const createOrganizer = asyncHandler(async (req, res) => {
  const { organizerName, category, description, contactEmail, contactNumber } = req.body;

  if (!organizerName || !category || !description || !contactEmail) {
    throw new ApiError(400, 'Organizer name, category, description, and contact email are required');
  }

  const email = await generateOrganizerEmail(organizerName);
  const plainPassword = generateStrongPassword(12);

  const organizer = await User.create({
    email,
    password: plainPassword,
    role: 'organizer',
    organizerName,
    category,
    description,
    contactEmail,
    contactNumber,
    createdByAdmin: true,
    isDisabled: false,
  });

  const organizerObj = organizer.toObject();
  delete organizerObj.password;

  res.status(201).json(
    new ApiResponse('Organizer account created', {
      organizer: organizerObj,
      credentials: {
        loginEmail: email,
        password: plainPassword,
      },
    })
  );
});

const listOrganizers = asyncHandler(async (_req, res) => {
  const organizers = await User.find({ role: 'organizer' })
    .select(
      'email organizerName category description contactEmail contactNumber isDisabled isArchived createdAt'
    )
    .sort({ createdAt: -1 })
    .lean();

  res.json(new ApiResponse('Organizer list fetched', organizers));
});

const updateOrganizerStatus = asyncHandler(async (req, res) => {
  const { organizerId } = req.params;
  const { action } = req.body;

  const organizer = await User.findOne({ _id: organizerId, role: 'organizer' });
  if (!organizer) {
    throw new ApiError(404, 'Organizer not found');
  }

  if (!['disable', 'enable', 'archive', 'delete'].includes(action)) {
    throw new ApiError(400, 'Invalid action');
  }

  if (action === 'disable') organizer.isDisabled = true;
  if (action === 'enable') organizer.isDisabled = false;
  if (action === 'archive') organizer.isArchived = true;

  if (action === 'delete') {
    const orgEvents = await Event.find({ organizerId: organizer._id }).select('_id').lean();
    const orgEventIds = orgEvents.map((e) => e._id);
    await Ticket.deleteMany({ eventId: { $in: orgEventIds } });
    await AttendanceLog.deleteMany({ eventId: { $in: orgEventIds } });
    await Event.deleteMany({ organizerId: organizer._id });
    await Registration.deleteMany({ organizerId: organizer._id });
    await PasswordResetRequest.deleteMany({ organizerId: organizer._id });
    await organizer.deleteOne();
    res.json(new ApiResponse('Organizer permanently deleted'));
    return;
  }

  await organizer.save();
  res.json(new ApiResponse(`Organizer ${action} action applied`, organizer));
});

const listPasswordResetRequests = asyncHandler(async (_req, res) => {
  const requests = await PasswordResetRequest.find({})
    .populate('organizerId', 'organizerName email category')
    .populate('resolvedBy', 'email')
    .sort({ createdAt: -1 })
    .lean();

  res.json(new ApiResponse('Password reset requests fetched', requests));
});

const handlePasswordResetRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { decision, adminComment } = req.body;

  if (!['approved', 'rejected'].includes(decision)) {
    throw new ApiError(400, 'Decision must be approved/rejected');
  }

  const requestDoc = await PasswordResetRequest.findById(requestId);
  if (!requestDoc) throw new ApiError(404, 'Request not found');

  if (requestDoc.status !== 'pending') {
    throw new ApiError(400, 'Request already resolved');
  }

  requestDoc.status = decision;
  requestDoc.adminComment = adminComment || '';
  requestDoc.resolvedAt = new Date();
  requestDoc.resolvedBy = req.user._id;

  let newPassword = null;

  if (decision === 'approved') {
    const organizer = await User.findById(requestDoc.organizerId).select('+password');
    if (!organizer || organizer.role !== 'organizer') {
      throw new ApiError(404, 'Organizer not found');
    }

    newPassword = generateStrongPassword(12);
    organizer.password = newPassword;
    await organizer.save();

    // Password only returned in API response, never persisted in DB
  }

  await requestDoc.save();

  res.json(
    new ApiResponse('Password reset request handled', {
      request: requestDoc,
      generatedPassword: newPassword,
    })
  );
});

module.exports = {
  getDashboard,
  createOrganizer,
  listOrganizers,
  updateOrganizerStatus,
  listPasswordResetRequests,
  handlePasswordResetRequest,
};
