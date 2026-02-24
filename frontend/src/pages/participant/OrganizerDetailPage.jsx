import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrganizerDetails } from '../../api/events';
import LoadingState from '../../components/LoadingState';

function OrganizerDetailPage() {
  const { organizerId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getOrganizerDetails(organizerId)
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [organizerId]);

  if (loading) return <LoadingState label="Loading organizer details..." />;
  if (!data?.organizer) return <p className="error">Organizer not found.</p>;

  return (
    <section className="stack">
      <div className="card">
        <h2>{data.organizer.organizerName}</h2>
        <p className="muted">{data.organizer.category}</p>
        <p>{data.organizer.description}</p>
        <p>
          Contact: <a href={`mailto:${data.organizer.contactEmail}`}>{data.organizer.contactEmail}</a>
        </p>
      </div>

      <div className="card">
        <h3>Upcoming Events</h3>
        {(data.upcoming || []).map((event) => (
          <article key={event._id} className="list-item">
            <div>
              <strong>{event.name}</strong>
              <p className="muted">{dayjs(event.startDate).format('DD MMM YYYY HH:mm')}</p>
            </div>
            <Link className="btn" to={`/participant/events/${event._id}`}>
              Open
            </Link>
          </article>
        ))}
        {(data.upcoming || []).length === 0 ? <p className="muted">No upcoming events.</p> : null}
      </div>

      <div className="card">
        <h3>Past Events</h3>
        {(data.past || []).map((event) => (
          <article key={event._id} className="list-item">
            <div>
              <strong>{event.name}</strong>
              <p className="muted">{dayjs(event.endDate).format('DD MMM YYYY HH:mm')}</p>
            </div>
            <Link className="btn ghost" to={`/participant/events/${event._id}`}>
              View
            </Link>
          </article>
        ))}
        {(data.past || []).length === 0 ? <p className="muted">No past events.</p> : null}
      </div>
    </section>
  );
}

export default OrganizerDetailPage;
