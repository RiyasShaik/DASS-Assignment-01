const { verifyToken } = require('../services/token.service');
const Event = require('../models/Event');
const Registration = require('../models/Registration');

const canAccessEventDiscussion = async (socketUser, eventId) => {
  const event = await Event.findById(eventId).select('organizerId').lean();
  if (!event) {
    return { ok: false, reason: 'Event not found' };
  }

  if (socketUser.role === 'admin') {
    return { ok: true };
  }

  if (socketUser.role === 'organizer') {
    return {
      ok: String(event.organizerId) === String(socketUser.id),
      reason: 'Only event organizer can join this discussion',
    };
  }

  const registration = await Registration.findOne({
    eventId,
    participantId: socketUser.id,
    status: { $in: ['registered', 'pending_approval', 'purchase_success', 'completed'] },
  })
    .select('_id')
    .lean();

  return {
    ok: Boolean(registration),
    reason: 'Only registered participants can join this discussion',
  };
};

const initDiscussionSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const payload = verifyToken(token);
      socket.user = payload;
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('discussion:join', async ({ eventId }) => {
      if (!eventId) return;
      try {
        const access = await canAccessEventDiscussion(socket.user, eventId);
        if (!access.ok) {
          socket.emit('discussion:error', { eventId, message: access.reason || 'Forbidden discussion access' });
          return;
        }

        socket.join(`event:${eventId}`);
        io.to(`event:${eventId}`).emit('discussion:presence', {
          userId: socket.user.id,
          eventId,
          status: 'online',
        });
      } catch (error) {
        socket.emit('discussion:error', { eventId, message: 'Failed to join discussion room' });
      }
    });

    socket.on('discussion:leave', ({ eventId }) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      if (!socket.rooms.has(room)) return;
      socket.leave(`event:${eventId}`);
      io.to(`event:${eventId}`).emit('discussion:presence', {
        userId: socket.user.id,
        eventId,
        status: 'offline',
      });
    });

    socket.on('discussion:typing', ({ eventId, isTyping }) => {
      if (!eventId) return;
      const room = `event:${eventId}`;
      if (!socket.rooms.has(room)) return;
      socket.to(`event:${eventId}`).emit('discussion:typing', {
        userId: socket.user.id,
        eventId,
        isTyping: Boolean(isTyping),
      });
    });
  });
};

module.exports = initDiscussionSocket;
