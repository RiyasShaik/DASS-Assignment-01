import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listOrganizers } from '../../api/events';
import { updateParticipantPreferences } from '../../api/participant';

const suggestionInterests = [
  'coding',
  'robotics',
  'design',
  'music',
  'dance',
  'photography',
  'literature',
  'sports',
  'entrepreneurship',
];

function ParticipantOnboardingPage() {
  const navigate = useNavigate();
  const [interests, setInterests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listOrganizers()
      .then((res) => setOrganizers(res.data || []))
      .catch(() => setOrganizers([]));
  }, []);

  const toggleInterest = (interest) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleFollow = (id) => {
    setFollowed((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const save = async () => {
    setLoading(true);
    setError('');

    try {
      await updateParticipantPreferences({
        interests,
        followedOrganizers: followed,
      });
      navigate('/participant/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Onboarding Preferences</h2>
        <p className="muted">Select interests and clubs to personalize your event feed.</p>

        <h3>Areas of Interest</h3>
        <div className="tag-row">
          {suggestionInterests.map((interest) => (
            <button
              type="button"
              key={interest}
              className={interests.includes(interest) ? 'tag selected' : 'tag'}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </button>
          ))}
        </div>

        <h3>Clubs / Organizers to Follow</h3>
        <div className="list-grid">
          {organizers.map((org) => (
            <label key={org._id} className="check-card">
              <input
                type="checkbox"
                checked={followed.includes(org._id)}
                onChange={() => toggleFollow(org._id)}
              />
              <span>
                <strong>{org.organizerName}</strong>
                <span className="muted">{org.category}</span>
              </span>
            </label>
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <div className="row-gap">
          <button type="button" className="btn" onClick={save} disabled={loading}>
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('/participant/dashboard')}>
            Skip for now
          </button>
        </div>
      </div>
    </section>
  );
}

export default ParticipantOnboardingPage;
