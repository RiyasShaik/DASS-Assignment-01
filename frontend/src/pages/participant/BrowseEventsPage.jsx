import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { browseEvents, getTrendingEvents } from '../../api/events';
import EventCard from '../../components/EventCard';
import LoadingState from '../../components/LoadingState';

const initialFilters = {
  search: '',
  eventType: '',
  eligibility: '',
  category: '',
  from: '',
  to: '',
  followedOnly: false,
};

function BrowseEventsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  const query = useMemo(
    () => ({
      search: filters.search || undefined,
      eventType: filters.eventType || undefined,
      eligibility: filters.eligibility || undefined,
      category: filters.category || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      followedOnly: filters.followedOnly ? 'true' : undefined,
    }),
    [filters]
  );

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const [eventsRes, trendingRes] = await Promise.all([browseEvents(query), getTrendingEvents()]);
      setEvents(eventsRes.data?.events || []);
      setTrending(trendingRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => {
    e.preventDefault();
    fetchEvents();
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Browse Events</h2>
        <form className="filter-grid" onSubmit={applyFilters}>
          <label>
            Search Event/Organizer
            <input
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder="Fuzzy partial search"
            />
          </label>
          <label>
            Event Type
            <select
              value={filters.eventType}
              onChange={(e) => setFilters((p) => ({ ...p, eventType: e.target.value }))}
            >
              <option value="">All</option>
              <option value="normal">Normal</option>
              <option value="merchandise">Merchandise</option>
            </select>
          </label>
          <label>
            Eligibility
            <select
              value={filters.eligibility}
              onChange={(e) => setFilters((p) => ({ ...p, eligibility: e.target.value }))}
            >
              <option value="">All</option>
              <option value="all">All</option>
              <option value="iiit">IIIT</option>
              <option value="non_iiit">Non-IIIT</option>
            </select>
          </label>
          <label>
            Category
            <input
              value={filters.category}
              onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Tech, Cultural"
            />
          </label>
          <label>
            From Date
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            />
          </label>
          <label>
            To Date
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={filters.followedOnly}
              onChange={(e) => setFilters((p) => ({ ...p, followedOnly: e.target.checked }))}
            />
            Followed clubs only
          </label>
          <button type="submit" className="btn">
            Apply
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-row">
          <h2>Trending (Top 5 / last 24h)</h2>
          <Link to="/participant/dashboard">My Dashboard</Link>
        </div>
        <div className="list-grid">
          {trending.map((event) => (
            <article className="list-item" key={event._id}>
              <div>
                <strong>{event.name}</strong>
                <p className="muted">
                  {event.organizerId?.organizerName} | registrations in 24h: {event.recentRegistrations}
                </p>
              </div>
              <Link className="btn" to={`/participant/events/${event._id}`}>
                Open
              </Link>
            </article>
          ))}
          {trending.length === 0 ? <p className="muted">No trending events right now.</p> : null}
        </div>
      </div>

      <div className="stack">
        {loading ? <LoadingState label="Loading events..." /> : null}
        {!loading && events.length === 0 ? <p className="muted">No events matched your filters.</p> : null}
        {events.map((event) => (
          <EventCard key={event._id} event={event} linkTo={`/participant/events/${event._id}`} />
        ))}
      </div>
    </section>
  );
}

export default BrowseEventsPage;
