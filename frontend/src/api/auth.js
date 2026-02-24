import client from './client';

export const registerParticipant = async (payload) => {
  const { data } = await client.post('/auth/register/participant', payload);
  return data;
};

export const loginUser = async (payload) => {
  const { data } = await client.post('/auth/login', payload);
  return data;
};

export const getMe = async () => {
  const { data } = await client.get('/auth/me');
  return data;
};

export const changePassword = async (payload) => {
  const { data } = await client.post('/auth/change-password', payload);
  return data;
};

export const logoutUser = async () => {
  const { data } = await client.post('/auth/logout');
  return data;
};

export const requestOrganizerReset = async (payload) => {
  const { data } = await client.post('/auth/organizer-reset-request', payload);
  return data;
};
