import client from './client';

export const getAdminDashboard = async () => {
  const { data } = await client.get('/admin/dashboard');
  return data;
};

export const createOrganizerAccount = async (payload) => {
  const { data } = await client.post('/admin/organizers', payload);
  return data;
};

export const listOrganizerAccounts = async () => {
  const { data } = await client.get('/admin/organizers');
  return data;
};

export const updateOrganizerStatus = async (organizerId, action) => {
  const { data } = await client.patch(`/admin/organizers/${organizerId}/status`, { action });
  return data;
};

export const getPasswordResetRequests = async () => {
  const { data } = await client.get('/admin/password-reset-requests');
  return data;
};

export const handlePasswordResetRequest = async (requestId, payload) => {
  const { data } = await client.patch(`/admin/password-reset-requests/${requestId}`, payload);
  return data;
};
