import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

function EventCard({ event, linkTo, extra = null }) {
  return (
    <article className="card event-card">
      <div className="card-row">
        <h3>{event.name}</h3>
        <div className="row-gap">
          <span className={`pill ${event.type}`}>{event.type}</span>
          {event.category ? <span className="pill">{event.category}</span> : null}
        </div>
      </div>
      <p className="muted">{event.description}</p>
      <div className="meta-grid">
        <span>Organizer: {event.organizerId?.organizerName || 'N/A'}</span>
        <span>Status: <strong>{event.status}</strong></span>
        <span>Start: {dayjs(event.startDate).format('DD MMM YYYY, HH:mm')}</span>
        <span>Deadline: {dayjs(event.registrationDeadline).format('DD MMM YYYY, HH:mm')}</span>
        {event.venue ? <span>Venue: {event.venue}</span> : null}
        <span>Eligibility: {event.eligibility === 'all' ? 'Open to All' : event.eligibility === 'iiit' ? 'IIIT Only' : 'Non-IIIT'}</span>
      </div>
      {event.tags && event.tags.length > 0 ? (
        <div className="tag-row" style={{ marginTop: '0.5rem' }}>
          {event.tags.map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {extra}
      {linkTo ? (
        <Link className="btn" to={linkTo}>
          View Details
        </Link>
      ) : null}
    </article>
  );
}

export default EventCard;

