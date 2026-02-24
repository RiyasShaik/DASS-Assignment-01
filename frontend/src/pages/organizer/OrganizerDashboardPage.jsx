import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getOrganizerDashboard } from '../../api/organizer';
import EventCard from '../../components/EventCard';
import LoadingState from '../../components/LoadingState';

function OrganizerDashboardPage() {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('all');

  useEffect(() => {
    let mounted = true;
    getOrganizerDashboard()
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const events = data?.events || [];
  const filtered = useMemo(() => {
    if (activeView === 'ongoing') {
      return events.filter((e) => e.status === 'ongoing');
    }
    if (activeView === 'published') {
      return events.filter((e) => e.status === 'published');
    }
    if (activeView === 'draft') {
      return events.filter((e) => e.status === 'draft');
    }
    if (activeView === 'completed') {
      return events.filter((e) => e.status === 'completed');
    }
    return events;
  }, [events, activeView]);

  if (loading) return <LoadingState label="Loading organizer dashboard..." />;
  if (error) return (
    <section className="stack">
      <div className="card">
        <h2>Dashboard Error</h2>
        <p className="error">{error}</p>
      </div>
    </section>
  );

  return (
    <section className="stack">
      <div className="card">
        <div className="card-row">
          <h2>Events Dashboard</h2>
          <Link className="btn" to="/organizer/events/new">
            Create New Event
          </Link>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={activeView === 'all' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('all')}
          >
            All Events
          </button>
          <button
            type="button"
            className={activeView === 'draft' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('draft')}
          >
            Draft
          </button>
          <button
            type="button"
            className={activeView === 'published' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('published')}
          >
            Published
          </button>
          <button
            type="button"
            className={activeView === 'ongoing' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('ongoing')}
          >
            Ongoing
          </button>
          <button
            type="button"
            className={activeView === 'completed' ? 'tab active' : 'tab'}
            onClick={() => setActiveView('completed')}
          >
            Completed
          </button>
        </div>

        <div className="horizontal-scroll">
          {filtered.map((event) => (
            <div className="scroll-item" key={event._id}>
              <EventCard event={event} linkTo={`/organizer/events/${event._id}`} />
            </div>
          ))}
        </div>
        {filtered.length === 0 ? <p className="muted">No events available for this view.</p> : null}
      </div>

      <div className="card">
        <h2>Completed Event Analytics</h2>
        {(data?.eventAnalytics || []).length === 0 ? (
          <p className="muted">No completed events yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Registrations</th>
                  <th>Sales</th>
                  <th>Revenue</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {(data?.eventAnalytics || []).map((item) => (
                  <tr key={item.eventId}>
                    <td>{item.name}</td>
                    <td>{item.type}</td>
                    <td>{item.registrations || 0}</td>
                    <td>{item.sales || 0}</td>
                    <td>INR {item.revenue || 0}</td>
                    <td>{item.attendance || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default OrganizerDashboardPage;
