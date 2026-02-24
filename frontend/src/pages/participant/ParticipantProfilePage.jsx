import { useEffect, useState } from 'react';
import { changePassword } from '../../api/auth';
import { listOrganizers } from '../../api/events';
import {
  getParticipantProfile,
  updateParticipantPreferences,
  updateParticipantProfile,
} from '../../api/participant';
import LoadingState from '../../components/LoadingState';

function ParticipantProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [organizers, setOrganizers] = useState([]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    collegeName: '',
    interestsRaw: '',
    followed: [],
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const [profileRes, organizersRes] = await Promise.all([getParticipantProfile(), listOrganizers()]);

    const p = profileRes.data;
    setProfile(p);
    setOrganizers(organizersRes.data || []);
    setForm({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      contactNumber: p.contactNumber || '',
      collegeName: p.collegeName || '',
      interestsRaw: (p.interests || []).join(', '),
      followed: (p.followedOrganizers || []).map((o) => o._id),
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchData().catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setError('');
    setMessage('');

    try {
      await updateParticipantProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        contactNumber: form.contactNumber,
        collegeName: form.collegeName,
        interests: form.interestsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });

      await updateParticipantPreferences({
        interests: form.interestsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        followedOrganizers: form.followed,
      });

      setMessage('Profile updated successfully');
      fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update profile');
    }
  };

  const updatePassword = async () => {
    setError('');
    setMessage('');

    try {
      await changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setMessage('Password updated successfully');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update password');
    }
  };

  const toggleFollow = (id) => {
    setForm((prev) => ({
      ...prev,
      followed: prev.followed.includes(id)
        ? prev.followed.filter((x) => x !== id)
        : [...prev.followed, id],
    }));
  };

  if (loading) return <LoadingState label="Loading profile..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>Participant Profile</h2>
        <div className="meta-grid">
          <span>Email (non-editable): {profile.email}</span>
          <span>Participant Type (non-editable): {profile.participantType}</span>
        </div>

        <div className="form-grid">
          <label>
            First Name
            <input
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            />
          </label>
          <label>
            Last Name
            <input
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            />
          </label>
          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
            />
          </label>
          <label>
            College/Organization Name
            <input
              value={form.collegeName}
              onChange={(e) => setForm((p) => ({ ...p, collegeName: e.target.value }))}
            />
          </label>
          <label className="full">
            Interests (comma separated)
            <input
              value={form.interestsRaw}
              onChange={(e) => setForm((p) => ({ ...p, interestsRaw: e.target.value }))}
            />
          </label>
        </div>

        <h3>Followed Clubs</h3>
        <div className="list-grid">
          {organizers.map((org) => (
            <label key={org._id} className="check-card">
              <input
                type="checkbox"
                checked={form.followed.includes(org._id)}
                onChange={() => toggleFollow(org._id)}
              />
              <span>
                <strong>{org.organizerName}</strong>
                <span className="muted">{org.category}</span>
              </span>
            </label>
          ))}
        </div>

        <button type="button" className="btn" onClick={saveProfile}>
          Save Profile
        </button>
      </div>

      <div className="card">
        <h3>Security Settings</h3>
        <div className="form-grid">
          <label>
            Current Password
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  currentPassword: e.target.value,
                }))
              }
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              minLength={8}
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  newPassword: e.target.value,
                }))
              }
            />
          </label>
        </div>

        <button type="button" className="btn" onClick={updatePassword}>
          Change Password
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
    </section>
  );
}

export default ParticipantProfilePage;
