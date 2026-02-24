const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { signToken } = require('../services/token.service');

const sanitizeUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
};

const buildLoginPayload = (user) => {
  const token = signToken({ id: user._id, role: user.role, email: user.email });
  return {
    token,
    user: sanitizeUser(user),
  };
};

const registerParticipant = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    participantType,
    collegeName,
    contactNumber,
  } = req.body;

  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!['iiit', 'non_iiit'].includes(participantType)) {
    throw new ApiError(400, 'Invalid participant type');
  }

  if (participantType === 'iiit') {
    const emailDomain = normalizedEmail.split('@')[1] || '';
    const iiitBase = env.iiitEmailDomain.replace(/^@/, '').toLowerCase();
    if (!emailDomain.endsWith(iiitBase)) {
      throw new ApiError(400, `IIIT participants must use an IIIT-issued email (e.g. @iiit.ac.in, @students.iiit.ac.in, @research.iiit.ac.in)`);
    }
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, 'Email already registered');
  }

  const user = await User.create({
    firstName,
    lastName,
    email: normalizedEmail,
    password,
    role: 'participant',
    participantType,
    collegeName,
    contactNumber,
    interests: [],
    followedOrganizers: [],
  });

  const payload = buildLoginPayload(user);
  res.status(201).json(new ApiResponse('Participant registered successfully', payload));
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (user.role === 'organizer' && user.isDisabled) {
    throw new ApiError(403, 'Organizer account is disabled');
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const payload = buildLoginPayload(user);
  res.json(new ApiResponse('Login successful', payload));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'followedOrganizers', select: 'organizerName category description contactEmail' })
    .lean();

  res.json(new ApiResponse('Current user fetched', user));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  const ok = await user.comparePassword(currentPassword);

  if (!ok) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse('Password changed successfully'));
});

const logout = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse('Logout successful. Clear token on client side.'));
});

const requestOrganizerPasswordReset = asyncHandler(async (req, res) => {
  const { email, reason } = req.body;

  const organizer = await User.findOne({ email, role: 'organizer' });

  if (!organizer) {
    throw new ApiError(404, 'No organizer account found with this email');
  }

  if (organizer.isDisabled || organizer.isArchived) {
    throw new ApiError(403, 'This organizer account is disabled or archived. Contact admin directly.');
  }


  const existing = await PasswordResetRequest.findOne({
    organizerId: organizer._id,
    status: 'pending',
  });

  if (existing) {
    throw new ApiError(409, 'A password reset request is already pending for this account');
  }

  await PasswordResetRequest.create({
    organizerId: organizer._id,
    reason: reason || 'Forgot password',
  });

  res.status(201).json(new ApiResponse('Password reset request submitted. Admin will review it shortly.'));
});

module.exports = {
  registerParticipant,
  login,
  getCurrentUser,
  changePassword,
  logout,
  requestOrganizerPasswordReset,
};
