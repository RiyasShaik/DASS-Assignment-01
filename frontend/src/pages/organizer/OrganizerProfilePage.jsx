import { useEffect, useState } from 'react';
import {
  getMyPasswordResetRequests,
  getOrganizerProfile,
  requestPasswordReset,
  updateOrganizerProfile,
} from '../../api/organizer';
import LoadingState from '../../components/LoadingState';

function OrganizerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({
    organizerName: '',
    category: '',
    description: '',
    contactEmail: '',
    contactNumber: '',
    discordWebhook: '',
  });
  const [resetReason, setResetReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [profileRes, requestsRes] = await Promise.all([
      getOrganizerProfile(),
      getMyPasswordResetRequests(),
    ]);

    const p = profileRes.data;
    setProfile(p);
    setForm({
      organizerName: p.organizerName || '',
      category: p.category || '',
      description: p.description || '',
      contactEmail: p.contactEmail || '',
      contactNumber: p.contactNumber || '',
      discordWebhook: p.discordWebhook || '',
    });
    setRequests(requestsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([getOrganizerProfile(), getMyPasswordResetRequests()])
      .then(([profileRes, requestsRes]) => {
        if (!mounted) return;
        const p = profileRes.data;
        setProfile(p);
        setForm({
          organizerName: p.organizerName || '',
          category: p.category || '',
          description: p.description || '',
          contactEmail: p.contactEmail || '',
          contactNumber: p.contactNumber || '',
          discordWebhook: p.discordWebhook || '',
        });
        setRequests(requestsRes.data || []);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Failed to load profile data');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const saveProfile = async () => {
    setError('');
    setMessage('');

    try {
      await updateOrganizerProfile(form);
      setMessage('Organizer profile updated');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update organizer profile');
    }
  };

  const submitResetRequest = async () => {
    setError('');
    setMessage('');

    try {
      await requestPasswordReset({ reason: resetReason });
      setMessage('Password reset request submitted to admin');
      setResetReason('');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to request password reset');
    }
  };

  if (loading) return <LoadingState label="Loading organizer profile..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>Organizer Profile</h2>
        <p className="muted">Login Email (non-editable): {profile.email}</p>

        <div className="form-grid">
          <label>
            Organizer Name
            <input
              value={form.organizerName}
              onChange={(e) => setForm((p) => ({ ...p, organizerName: e.target.value }))}
            />
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            />
          </label>
          <label className="full">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </label>
          <label>
            Contact Email
            <input
              value={form.contactEmail}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
            />
          </label>
          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
            />
          </label>
          <label className="full">
            Discord Webhook URL
            <input
              value={form.discordWebhook}
              onChange={(e) => setForm((p) => ({ ...p, discordWebhook: e.target.value }))}
            />
          </label>
        </div>

        <button type="button" className="btn" onClick={saveProfile}>
          Save Profile
        </button>
      </div>

      <div className="card">
        <h3>Password Reset Workflow (Organizer to Admin)</h3>
        <label>
          Reason
          <textarea
            rows={3}
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            placeholder="Explain why reset is needed"
          />
        </label>
        <button type="button" className="btn ghost" onClick={submitResetRequest}>
          Request Password Reset
        </button>

        <h4>Request History</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Comment</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id}>
                  <td>{new Date(req.createdAt).toLocaleString()}</td>
                  <td>{req.reason}</td>
                  <td>{req.status}</td>
                  <td>{req.adminComment || '-'}</td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4}>No requests found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
    </section>
  );
}

export default OrganizerProfilePage;
