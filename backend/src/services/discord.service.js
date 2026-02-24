const User = require('../models/User');

const postEventToDiscord = async ({ organizerId, event }) => {
  const organizer = await User.findById(organizerId).select('discordWebhook organizerName').lean();

  if (!organizer?.discordWebhook) {
    return { skipped: true, reason: 'No discord webhook configured' };
  }

  const payload = {
    username: 'Felicity Events Bot',
    content: `New event published by ${organizer.organizerName || 'Organizer'}: **${event.name}**\nType: ${event.type}\nStart: ${new Date(event.startDate).toLocaleString()}\nDeadline: ${new Date(event.registrationDeadline).toLocaleString()}`,
  };

  const response = await fetch(organizer.discordWebhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
  };
};

module.exports = {
  postEventToDiscord,
};
