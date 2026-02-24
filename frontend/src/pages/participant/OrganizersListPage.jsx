import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrganizers } from '../../api/events';
import { followOrganizer, getParticipantProfile, unfollowOrganizer } from '../../api/participant';
import LoadingState from '../../components/LoadingState';

function OrganizersListPage() {
  const [organizers, setOrganizers] = useState([]);
  const [followed, setFollowed] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([listOrganizers(), getParticipantProfile()])
      .then(([orgRes, profileRes]) => {
        if (!mounted) return;
        setOrganizers(orgRes.data || []);
        const ids = new Set((profileRes.data?.followedOrganizers || []).map((o) => o._id));
        setFollowed(ids);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleFollow = async (organizerId) => {
    if (followed.has(organizerId)) {
      await unfollowOrganizer(organizerId);
      setFollowed((prev) => {
        const next = new Set(prev);
        next.delete(organizerId);
        return next;
      });
      return;
    }

    await followOrganizer(organizerId);
    setFollowed((prev) => {
      const next = new Set(prev);
      next.add(organizerId);
      return next;
    });
  };

  if (loading) return <LoadingState label="Loading organizers..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>Approved Organizers</h2>
        <div className="list-grid">
          {organizers.map((organizer) => (
            <article className="list-item" key={organizer._id}>
              <div>
                <strong>{organizer.organizerName}</strong>
                <p className="muted">{organizer.category}</p>
                <p>{organizer.description}</p>
              </div>
              <div className="row-gap">
                <button
                  type="button"
                  className={followed.has(organizer._id) ? 'btn ghost' : 'btn'}
                  onClick={() => toggleFollow(organizer._id)}
                >
                  {followed.has(organizer._id) ? 'Unfollow' : 'Follow'}
                </button>
                <Link className="btn ghost" to={`/participant/organizers/${organizer._id}`}>
                  View
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default OrganizersListPage;
