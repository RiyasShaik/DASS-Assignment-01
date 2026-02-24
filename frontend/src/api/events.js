import client from './client';

export const browseEvents = async (params = {}) => {
  const { data } = await client.get('/events', { params });
  return data;
};

export const getTrendingEvents = async () => {
  const { data } = await client.get('/events/trending');
  return data;
};

export const getEventDetails = async (eventId) => {
  const { data } = await client.get(`/events/${eventId}`);
  return data;
};

export const listOrganizers = async () => {
  const { data } = await client.get('/events/organizers');
  return data;
};

export const getOrganizerDetails = async (organizerId) => {
  const { data } = await client.get(`/events/organizers/${organizerId}`);
  return data;
};

export const getDiscussionMessages = async (eventId) => {
  const { data } = await client.get(`/events/${eventId}/discussion`);
  return data;
};

export const postDiscussionMessage = async (eventId, payload) => {
  const { data } = await client.post(`/events/${eventId}/discussion`, payload);
  return data;
};

export const deleteDiscussionMessage = async (eventId, messageId) => {
  const { data } = await client.delete(`/events/${eventId}/discussion/${messageId}`);
  return data;
};

export const pinDiscussionMessage = async (eventId, messageId) => {
  const { data } = await client.patch(`/events/${eventId}/discussion/${messageId}/pin`);
  return data;
};

export const reactDiscussionMessage = async (eventId, messageId, emoji) => {
  const { data } = await client.post(`/events/${eventId}/discussion/${messageId}/react`, { emoji });
  return data;
};

export const getCalendarLinks = async (ticketCode) => {
  const { data } = await client.get(`/events/tickets/${ticketCode}/calendar-links`);
  return data;
};
