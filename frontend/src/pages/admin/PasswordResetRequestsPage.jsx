import { useEffect, useState } from 'react';
import {
  getPasswordResetRequests,
  handlePasswordResetRequest,
} from '../../api/admin';
import LoadingState from '../../components/LoadingState';

function PasswordResetRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [comments, setComments] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchRequests = async () => {
    const res = await getPasswordResetRequests();
    setRequests(res.data || []);
  };

  useEffect(() => {
    fetchRequests()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const resolveRequest = async (requestId, decision) => {
    setError('');
    setMessage('');

    try {
      const res = await handlePasswordResetRequest(requestId, {
        decision,
        adminComment:
          comments[requestId]?.trim() ||
          (decision === 'approved' ? 'Approved by admin' : 'Rejected by admin'),
      });
      if (res.data.generatedPassword) {
        setMessage(`Approved. New password: ${res.data.generatedPassword}`);
      } else {
        setMessage(`Request ${decision}.`);
      }
      setComments((prev) => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      await fetchRequests();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to resolve request');
    }
  };

  if (loading) return <LoadingState label="Loading password reset requests..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>Organizer Password Reset Requests</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Organizer</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin Comment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id}>
                  <td>{req.organizerId?.organizerName || req.organizerId?.email}</td>
                  <td>{new Date(req.createdAt).toLocaleString()}</td>
                  <td>{req.reason}</td>
                  <td>{req.status}</td>
                  <td>{req.adminComment || '-'}</td>
                  <td>
                    {req.status === 'pending' ? (
                      <div className="stack">
                        <textarea
                          rows={2}
                          value={comments[req._id] || ''}
                          placeholder="Optional admin comment"
                          onChange={(e) =>
                            setComments((prev) => ({
                              ...prev,
                              [req._id]: e.target.value,
                            }))
                          }
                        />
                        <div className="row-gap">
                          <button
                            type="button"
                            className="btn"
                            onClick={() => resolveRequest(req._id, 'approved')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => resolveRequest(req._id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      'Resolved'
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6}>No reset requests yet.</td>
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

export default PasswordResetRequestsPage;
