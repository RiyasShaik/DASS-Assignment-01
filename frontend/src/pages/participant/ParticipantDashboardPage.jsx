import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { getParticipantDashboard } from '../../api/participant';
import LoadingState from '../../components/LoadingState';

const tabs = [
  { id: 'normal', label: 'Normal' },
  { id: 'merchandise', label: 'Merchandise' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelledRejected', label: 'Cancelled/Rejected' },
];

function ParticipantDashboardPage() {
  const [activeTab, setActiveTab] = useState('normal');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getParticipantDashboard()
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

  if (loading) return <LoadingState label="Loading participant dashboard..." />;

  const upcoming = data?.upcoming || [];
  const history = data?.history || {};
  const records = history[activeTab] || [];

  return (
    <section className="stack">
      <div className="card">
        <h2>Upcoming Events</h2>
        {upcoming.length === 0 ? <p className="muted">No upcoming registrations yet.</p> : null}

        <div className="list-grid">
          {upcoming.map((item) => (
            <article key={item._id} className="list-item">
              <div>
                <strong>{item.eventId?.name}</strong>
                <p className="muted">
                  {item.type} | {item.eventId?.organizerId?.organizerName}
                </p>
                <p className="muted">
                  {dayjs(item.eventId?.startDate).format('DD MMM YYYY HH:mm')} -{' '}
                  {dayjs(item.eventId?.endDate).format('DD MMM YYYY HH:mm')}
                </p>
              </div>
              <Link className="btn" to={`/participant/events/${item.eventId?._id}`}>
                Open
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Participation History</h2>
        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {records.length === 0 ? <p className="muted">No records in this category.</p> : null}

        <div className="table-wrap">
          {records.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Type</th>
                  <th>Organizer</th>
                  <th>Status</th>
                  <th>Team</th>
                  <th>Ticket ID</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record._id}>
                    <td>{record.eventId?.name}</td>
                    <td>{record.type}</td>
                    <td>{record.eventId?.organizerId?.organizerName || 'N/A'}</td>
                    <td>{record.status}</td>
                    <td>-</td>
                    <td>
                      {record.ticketId?.ticketId ? (
                        <Link to={`/participant/events/${record.eventId?._id}`}>
                          {record.ticketId.ticketId}
                        </Link>
                      ) : (
                        'Not issued'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ParticipantDashboardPage;
