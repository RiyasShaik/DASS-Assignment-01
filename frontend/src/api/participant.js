import client from './client';

export const getParticipantDashboard = async () => {
  const { data } = await client.get('/participants/dashboard');
  return data;
};

export const getParticipantProfile = async () => {
  const { data } = await client.get('/participants/profile');
  return data;
};

export const updateParticipantProfile = async (payload) => {
  const { data } = await client.patch('/participants/profile', payload);
  return data;
};

export const updateParticipantPreferences = async (payload) => {
  const { data } = await client.patch('/participants/preferences', payload);
  return data;
};

export const followOrganizer = async (organizerId) => {
  const { data } = await client.post(`/participants/organizers/${organizerId}/follow`);
  return data;
};

export const unfollowOrganizer = async (organizerId) => {
  const { data } = await client.delete(`/participants/organizers/${organizerId}/follow`);
  return data;
};

export const registerNormalEvent = async (eventId, payload) => {
  const config =
    payload instanceof FormData
      ? {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      : undefined;

  const { data } = await client.post(`/participants/events/${eventId}/register`, payload, config);
  return data;
};

export const createMerchOrder = async (eventId, formData) => {
  const { data } = await client.post(`/participants/events/${eventId}/merch-order`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

export const getMyRegistrations = async () => {
  const { data } = await client.get('/participants/registrations');
  return data;
};

export const getTicket = async (ticketCode) => {
  const { data } = await client.get(`/participants/tickets/${ticketCode}`);
  return data;
};
