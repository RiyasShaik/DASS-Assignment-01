import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="center-card">
      <h1>404</h1>
      <p>Requested page not found.</p>
      <Link className="btn" to="/">
        Go Home
      </Link>
    </div>
  );
}

export default NotFoundPage;
