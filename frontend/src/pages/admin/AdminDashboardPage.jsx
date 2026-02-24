import { useEffect, useState } from 'react';
import { getAdminDashboard } from '../../api/admin';
import LoadingState from '../../components/LoadingState';

function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    getAdminDashboard()
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

  if (loading) return <LoadingState label="Loading admin dashboard..." />;

  return (
    <section className="stack">
      <div className="card">
        <h2>System Overview</h2>
        <div className="stats-grid">
          <article className="stat-card">
            <h3>{data.participants}</h3>
            <p>Participants</p>
          </article>
          <article className="stat-card">
            <h3>{data.organizers}</h3>
            <p>Organizers</p>
          </article>
          <article className="stat-card">
            <h3>{data.events}</h3>
            <p>Events</p>
          </article>
          <article className="stat-card">
            <h3>{data.registrations}</h3>
            <p>Total Registrations/Orders</p>
          </article>
          <article className="stat-card">
            <h3>{data.pendingResetRequests}</h3>
            <p>Pending Reset Requests</p>
          </article>
        </div>
      </div>
    </section>
  );
}

export default AdminDashboardPage;
