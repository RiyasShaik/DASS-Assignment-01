import client from './client';

export const getOrganizerDashboard = async () => {
  const { data } = await client.get('/organizer/dashboard');
  return data;
};

export const getOrganizerProfile = async () => {
  const { data } = await client.get('/organizer/profile');
  return data;
};

export const updateOrganizerProfile = async (payload) => {
  const { data } = await client.patch('/organizer/profile', payload);
  return data;
};

export const createEventDraft = async (payload) => {
  const { data } = await client.post('/organizer/events', payload);
  return data;
};

export const updateEvent = async (eventId, payload) => {
  const { data } = await client.put(`/organizer/events/${eventId}`, payload);
  return data;
};

export const publishEvent = async (eventId) => {
  const { data } = await client.patch(`/organizer/events/${eventId}/publish`);
  return data;
};

export const getOrganizerEventDetails = async (eventId, params = {}) => {
  const { data } = await client.get(`/organizer/events/${eventId}`, { params });
  return data;
};

export const listPendingOrders = async (eventId) => {
  const { data } = await client.get(`/organizer/events/${eventId}/orders/pending`);
  return data;
};

export const reviewOrder = async (eventId, registrationId, payload) => {
  const { data } = await client.patch(
    `/organizer/events/${eventId}/orders/${registrationId}/review`,
    payload
  );
  return data;
};

export const scanTicket = async (eventId, payload) => {
  const { data } = await client.post(`/organizer/events/${eventId}/attendance/scan`, payload);
  return data;
};

export const overrideAttendance = async (eventId, payload) => {
  const { data } = await client.post(`/organizer/events/${eventId}/attendance/override`, payload);
  return data;
};

export const getAttendanceDashboard = async (eventId) => {
  const { data } = await client.get(`/organizer/events/${eventId}/attendance`);
  return data;
};

export const requestPasswordReset = async (payload) => {
  const { data } = await client.post('/organizer/password-reset-requests', payload);
  return data;
};

export const getMyPasswordResetRequests = async () => {
  const { data } = await client.get('/organizer/password-reset-requests');
  return data;
};
