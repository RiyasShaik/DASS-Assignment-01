import { useEffect, useState } from 'react';
import {
  createOrganizerAccount,
  listOrganizerAccounts,
  updateOrganizerStatus,
} from '../../api/admin';
import LoadingState from '../../components/LoadingState';

function ManageOrganizersPage() {
  const [loading, setLoading] = useState(true);
  const [organizers, setOrganizers] = useState([]);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    organizerName: '',
    category: '',
    description: '',
    contactEmail: '',
    contactNumber: '',
  });

  const fetchOrganizers = async () => {
    const res = await listOrganizerAccounts();
    setOrganizers(res.data || []);
  };

  useEffect(() => {
    fetchOrganizers()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const createOrganizer = async (e) => {
    e.preventDefault();
    setError('');
    setCredentials(null);

    try {
      const res = await createOrganizerAccount(form);
      setCredentials(res.data.credentials);
      setForm({
        organizerName: '',
        category: '',
        description: '',
        contactEmail: '',
        contactNumber: '',
      });
      await fetchOrganizers();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create organizer');
    }
  };

  const applyAction = async (organizerId, action) => {
    await updateOrganizerStatus(organizerId, action);
    await fetchOrganizers();
  };

  if (loading) return <LoadingState label="Loading organizers..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>Add New Club/Organizer</h2>
        <form className="form-grid" onSubmit={createOrganizer}>
          <label>
            Organizer Name
            <input
              value={form.organizerName}
              onChange={(e) => setForm((p) => ({ ...p, organizerName: e.target.value }))}
              required
            />
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              required
            />
          </label>
          <label className="full">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </label>
          <label>
            Contact Email
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((p) => ({ ...p, contactEmail: e.target.value }))}
              required
            />
          </label>
          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
            />
          </label>
          <button type="submit" className="btn full">
            Create Organizer Account
          </button>
        </form>

        {credentials ? (
          <div className="notice">
            <p>
              Auto-generated login email: <strong>{credentials.loginEmail}</strong>
            </p>
            <p>
              Auto-generated password: <strong>{credentials.password}</strong>
            </p>
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h2>All Organizers</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Email</th>
                <th>Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((org) => (
                <tr key={org._id}>
                  <td>{org.organizerName}</td>
                  <td>{org.category}</td>
                  <td>{org.contactEmail}</td>
                  <td>{org.email}</td>
                  <td>
                    {org.isArchived
                      ? 'Archived'
                      : org.isDisabled
                        ? 'Disabled'
                        : 'Active'}
                  </td>
                  <td>
                    <div className="row-gap">
                      <button type="button" className="btn ghost" onClick={() => applyAction(org._id, 'disable')}>
                        Disable
                      </button>
                      <button type="button" className="btn ghost" onClick={() => applyAction(org._id, 'enable')}>
                        Enable
                      </button>
                      <button type="button" className="btn ghost" onClick={() => applyAction(org._id, 'archive')}>
                        Archive
                      </button>
                      <button type="button" className="btn danger" onClick={() => applyAction(org._id, 'delete')}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {organizers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No organizers found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default ManageOrganizersPage;
