import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrganizerDashboard } from '../../api/organizer';
import EventCard from '../../components/EventCard';
import LoadingState from '../../components/LoadingState';

function OngoingEventsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOrganizerDashboard()
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState label="Loading ongoing events..." />;

  const ongoingEvents = (data?.events || []).filter((e) => e.status === 'ongoing');

  return (
    <section className="stack">
      <div className="card">
        <div className="card-row">
          <h2>Ongoing Events</h2>
          <Link className="btn" to="/organizer/dashboard">
            Back to Dashboard
          </Link>
        </div>

        {ongoingEvents.length === 0 ? (
          <p className="muted">No ongoing events at the moment.</p>
        ) : (
          <div className="list-grid">
            {ongoingEvents.map((event) => (
              <EventCard key={event._id} event={event} linkTo={`/organizer/events/${event._id}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default OngoingEventsPage;
