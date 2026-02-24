const path = require('path');
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const DiscussionMessage = require('../models/DiscussionMessage');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const {
  toICS,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
} = require('../services/calendar.service');

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFuzzyRegex = (query) => {
  const normalized = String(query || '').trim();
  if (!normalized) return null;

  const tokens = normalized.split(/\s+/).map((token) => escapeRegExp(token));
  const fuzzyPattern = tokens
    .map((token) => token.split('').join('.*'))
    .join('.*');

  return new RegExp(fuzzyPattern, 'i');
};

const ensureEventVisible = async (eventId, viewer) => {
  const event = await Event.findById(eventId).populate('organizerId', 'organizerName category description contactEmail');
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  if (event.status === 'draft' && viewer?.role !== 'admin') {
    const isOwnerOrganizer =
      viewer?.role === 'organizer' &&
      String(event.organizerId?._id || event.organizerId) === String(viewer._id);

    if (!isOwnerOrganizer) {
      throw new ApiError(403, 'This event is not publicly visible yet');
    }
  }

  return event;
};

const browseEvents = asyncHandler(async (req, res) => {
  const {
    search,
    eventType,
    eligibility,
    category,
    from,
    to,
    followedOnly,
    status,
    page = 1,
    limit = 20,
  } = req.query;

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);

  const match = {};

  if (status) {
    match.status = status;
  } else {
    match.status = { $in: ['published', 'ongoing', 'completed', 'closed'] };
  }

  if (eventType) {
    match.type = eventType;
  }

  if (eligibility) {
    match.eligibility = eligibility;
  }

  if (category) {
    match.category = category;
  }

  if (from || to) {
    match.startDate = {};
    if (from) match.startDate.$gte = new Date(from);
    if (to) match.startDate.$lte = new Date(to);
  }

  if (search) {
    const fuzzyRegex = buildFuzzyRegex(search);
    const fallbackRegex = new RegExp(escapeRegExp(search), 'i');
    const queryRegex = fuzzyRegex || fallbackRegex;

    const matchingOrganizers = await User.find({
      role: 'organizer',
      organizerName: { $regex: queryRegex },
    })
      .select('_id')
      .lean();

    const organizerIds = matchingOrganizers.map((o) => o._id);

    match.$or = [
      { name: { $regex: queryRegex } },
      { description: { $regex: queryRegex } },
      { tags: { $elemMatch: { $regex: queryRegex } } },
      ...(organizerIds.length > 0 ? [{ organizerId: { $in: organizerIds } }] : []),
    ];
  }

  if (req.user?.role === 'participant') {
    const participant = await User.findById(req.user._id).select('followedOrganizers interests participantType').lean();

    if (participant?.participantType) {
      const allowedEligibility = ['all', participant.participantType];
      if (eligibility) {
        if (!allowedEligibility.includes(eligibility)) {
          res.json(
            new ApiResponse('Events fetched successfully', {
              page: safePage,
              limit: safeLimit,
              total: 0,
              events: [],
            })
          );
          return;
        }
        match.eligibility = eligibility;
      } else {
        match.eligibility = { $in: allowedEligibility };
      }
    }

    if (followedOnly === 'true') {
      match.organizerId = { $in: participant.followedOrganizers || [] };
    }

    const events = await Event.find(match)
      .populate('organizerId', 'organizerName category')
      .sort({ startDate: 1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    const interestSet = new Set((participant.interests || []).map((i) => i.toLowerCase()));
    const followedSet = new Set((participant.followedOrganizers || []).map((i) => String(i)));

    const ranked = events
      .map((event) => {
        let score = 0;
        if (followedSet.has(String(event.organizerId?._id || event.organizerId))) score += 3;
        const tagMatch = (event.tags || []).some((tag) => interestSet.has(String(tag).toLowerCase()));
        if (tagMatch) score += 2;
        if (event.status === 'ongoing') score += 1;
        return { ...event, recommendationScore: score };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore || new Date(a.startDate) - new Date(b.startDate));

    const total = await Event.countDocuments(match);

    res.json(
      new ApiResponse('Events fetched successfully', {
        page: safePage,
        limit: safeLimit,
        total,
        events: ranked,
      })
    );
    return;
  }

  const [events, total] = await Promise.all([
    Event.find(match)
      .populate('organizerId', 'organizerName category')
      .sort({ startDate: 1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Event.countDocuments(match),
  ]);

  res.json(
    new ApiResponse('Events fetched successfully', {
      page: safePage,
      limit: safeLimit,
      total,
      events,
    })
  );
});

const getTrendingEvents = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const registrations = await Registration.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: { _id: '$eventId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  const eventIds = registrations.map((r) => r._id);
  const events = await Event.find({ _id: { $in: eventIds } })
    .populate('organizerId', 'organizerName category')
    .lean();

  const byId = new Map(events.map((e) => [String(e._id), e]));
  const top = registrations
    .map((r) => {
      const event = byId.get(String(r._id));
      if (!event) return null;
      return { ...event, recentRegistrations: r.count };
    })
    .filter(Boolean);

  res.json(new ApiResponse('Trending events fetched', top));
});

const getEventDetails = asyncHandler(async (req, res) => {
  const event = await ensureEventVisible(req.params.eventId, req.user);

  let registration = null;
  if (req.user?.role === 'participant') {
    registration = await Registration.findOne({
      eventId: event._id,
      participantId: req.user._id,
    })
      .populate('ticketId')
      .lean();
  }

  res.json(
    new ApiResponse('Event fetched successfully', {
      event,
      registration,
    })
  );
});

const getOrganizerPublicProfile = asyncHandler(async (req, res) => {
  const organizer = await User.findOne({ _id: req.params.organizerId, role: 'organizer' })
    .select('organizerName category description contactEmail')
    .lean();

  if (!organizer) {
    throw new ApiError(404, 'Organizer not found');
  }

  const now = new Date();
  const [upcoming, past] = await Promise.all([
    Event.find({ organizerId: organizer._id, startDate: { $gte: now }, status: { $ne: 'draft' } })
      .sort({ startDate: 1 })
      .lean(),
    Event.find({ organizerId: organizer._id, endDate: { $lt: now }, status: { $ne: 'draft' } })
      .sort({ startDate: -1 })
      .lean(),
  ]);

  res.json(new ApiResponse('Organizer profile fetched', { organizer, upcoming, past }));
});

const listOrganizers = asyncHandler(async (_req, res) => {
  const organizers = await User.find({ role: 'organizer', isDisabled: false, isArchived: false })
    .select('organizerName category description contactEmail')
    .sort({ organizerName: 1 })
    .lean();

  res.json(new ApiResponse('Organizers fetched', organizers));
});

const ensureDiscussionAccess = async ({ user, eventId }) => {
  const event = await Event.findById(eventId).lean();
  if (!event) throw new ApiError(404, 'Event not found');

  if (user.role === 'admin') return event;

  if (user.role === 'organizer') {
    if (String(event.organizerId) !== String(user._id)) {
      throw new ApiError(403, 'Only event organizer can access this forum');
    }
    return event;
  }

  const reg = await Registration.findOne({
    eventId,
    participantId: user._id,
    status: { $in: ['registered', 'purchase_success', 'completed', 'pending_approval'] },
  }).lean();

  if (!reg) {
    throw new ApiError(403, 'Only registered participants can access the discussion forum');
  }

  return event;
};

const getDiscussionMessages = asyncHandler(async (req, res) => {
  await ensureDiscussionAccess({ user: req.user, eventId: req.params.eventId });

  const messages = await DiscussionMessage.find({ eventId: req.params.eventId, isDeleted: false })
    .populate('userId', 'role firstName lastName organizerName email')
    .sort({ isPinned: -1, createdAt: 1 })
    .lean();

  res.json(new ApiResponse('Discussion messages fetched', messages));
});

const postDiscussionMessage = asyncHandler(async (req, res) => {
  const event = await ensureDiscussionAccess({ user: req.user, eventId: req.params.eventId });
  const { content, parentId, isAnnouncement = false } = req.body;

  if (!content || String(content).trim().length < 1) {
    throw new ApiError(400, 'Message content is required');
  }

  if (isAnnouncement && !['organizer', 'admin'].includes(req.user.role)) {
    throw new ApiError(403, 'Only organizers/admins can post announcements');
  }

  if (req.user.role === 'organizer' && String(event.organizerId) !== String(req.user._id)) {
    throw new ApiError(403, 'Only event organizer can post organizer announcements');
  }

  let parentMessageId = null;
  if (parentId) {
    const parentMessage = await DiscussionMessage.findOne({
      _id: parentId,
      eventId: req.params.eventId,
      isDeleted: false,
    }).lean();

    if (!parentMessage) {
      throw new ApiError(400, 'Reply target message not found in this event');
    }
    parentMessageId = parentMessage._id;
  }

  const message = await DiscussionMessage.create({
    eventId: req.params.eventId,
    userId: req.user._id,
    parentId: parentMessageId,
    content: String(content).trim(),
    isAnnouncement: Boolean(isAnnouncement),
  });

  const populated = await DiscussionMessage.findById(message._id)
    .populate('userId', 'role firstName lastName organizerName email')
    .lean();

  req.io.to(`event:${req.params.eventId}`).emit('discussion:message', populated);

  res.status(201).json(new ApiResponse('Message posted', populated));
});

const deleteDiscussionMessage = asyncHandler(async (req, res) => {
  const { eventId, messageId } = req.params;
  const message = await DiscussionMessage.findOne({ _id: messageId, eventId });

  if (!message || message.isDeleted) {
    throw new ApiError(404, 'Message not found');
  }

  const event = await Event.findById(eventId).lean();
  const isOwner = String(message.userId) === String(req.user._id);
  const isEventOrganizer =
    req.user.role === 'organizer' && String(event.organizerId) === String(req.user._id);

  if (!isOwner && !isEventOrganizer && req.user.role !== 'admin') {
    throw new ApiError(403, 'You cannot delete this message');
  }

  message.isDeleted = true;
  message.content = '[deleted]';
  await message.save();

  req.io.to(`event:${eventId}`).emit('discussion:deleted', { messageId: String(message._id) });
  res.json(new ApiResponse('Message deleted'));
});

const pinDiscussionMessage = asyncHandler(async (req, res) => {
  const { eventId, messageId } = req.params;
  const event = await Event.findById(eventId).lean();
  if (!event) {
    throw new ApiError(404, 'Event not found');
  }

  const isOrganizer = req.user.role === 'organizer' && String(event.organizerId) === String(req.user._id);
  if (!isOrganizer && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only organizer/admin can pin messages');
  }

  const message = await DiscussionMessage.findOne({ _id: messageId, eventId, isDeleted: false });
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  message.isPinned = !message.isPinned;
  await message.save();

  req.io.to(`event:${eventId}`).emit('discussion:pinned', {
    messageId: String(message._id),
    isPinned: message.isPinned,
  });

  res.json(new ApiResponse('Message pin status updated', { id: message._id, isPinned: message.isPinned }));
});

const reactToMessage = asyncHandler(async (req, res) => {
  const { eventId, messageId } = req.params;
  const { emoji } = req.body;

  await ensureDiscussionAccess({ user: req.user, eventId });

  if (!emoji || String(emoji).trim().length > 8) {
    throw new ApiError(400, 'Valid emoji is required');
  }

  const message = await DiscussionMessage.findOne({ _id: messageId, eventId, isDeleted: false });
  if (!message) {
    throw new ApiError(404, 'Message not found');
  }

  const reaction = message.reactions.find((r) => r.emoji === emoji);
  if (!reaction) {
    message.reactions.push({ emoji, users: [req.user._id] });
  } else {
    const userIndex = reaction.users.findIndex((u) => String(u) === String(req.user._id));
    if (userIndex === -1) {
      reaction.users.push(req.user._id);
    } else {
      reaction.users.splice(userIndex, 1);
      if (reaction.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    }
  }

  await message.save();

  req.io.to(`event:${eventId}`).emit('discussion:reaction', {
    messageId: String(message._id),
    reactions: message.reactions,
  });

  res.json(new ApiResponse('Reaction updated', message.reactions));
});

const getTicketCalendarLinks = asyncHandler(async (req, res) => {
  const { ticketCode } = req.params;

  const ticket = await Ticket.findOne({ ticketId: ticketCode }).populate('eventId');
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (req.user.role === 'participant' && String(ticket.participantId) !== String(req.user._id)) {
    throw new ApiError(403, 'Forbidden ticket access');
  }

  const event = ticket.eventId;
  const payload = {
    title: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
  };

  res.json(
    new ApiResponse('Calendar links generated', {
      ticketId: ticket.ticketId,
      googleUrl: buildGoogleCalendarUrl(payload),
      outlookUrl: buildOutlookCalendarUrl(payload),
      icsDownloadPath: `/api/events/tickets/${ticket.ticketId}/calendar.ics`,
    })
  );
});

const downloadTicketICS = asyncHandler(async (req, res) => {
  const { ticketCode } = req.params;

  const ticket = await Ticket.findOne({ ticketId: ticketCode }).populate('eventId');
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  if (req.user.role === 'participant' && String(ticket.participantId) !== String(req.user._id)) {
    throw new ApiError(403, 'Forbidden ticket access');
  }

  const event = ticket.eventId;
  const ics = toICS({
    title: event.name,
    description: event.description,
    location: 'IIIT Hyderabad',
    startDate: event.startDate,
    endDate: event.endDate,
  });

  const safeFilename = String(ticketCode).replace(/[^a-zA-Z0-9_-]/g, '');
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.ics"`);
  res.send(ics);
});

module.exports = {
  browseEvents,
  getTrendingEvents,
  getEventDetails,
  getOrganizerPublicProfile,
  listOrganizers,
  getDiscussionMessages,
  postDiscussionMessage,
  deleteDiscussionMessage,
  pinDiscussionMessage,
  reactToMessage,
  getTicketCalendarLinks,
  downloadTicketICS,
};
