import { Link, NavLink, useNavigate } from 'react-router-dom';
import { roleDefaultPath, useAuth } from '../context/AuthContext';

const linksByRole = {
  participant: [
    { to: '/participant/dashboard', label: 'Dashboard' },
    { to: '/participant/events', label: 'Browse Events' },
    { to: '/participant/organizers', label: 'Clubs/Organizers' },
    { to: '/participant/profile', label: 'Profile' },
  ],
  organizer: [
    { to: '/organizer/dashboard', label: 'Dashboard' },
    { to: '/organizer/events/new', label: 'Create Event' },
    { to: '/organizer/events/ongoing', label: 'Ongoing Events' },
    { to: '/organizer/profile', label: 'Profile' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/organizers', label: 'Manage Clubs/Organizers' },
    { to: '/admin/reset-requests', label: 'Password Reset Requests' },
  ],
};

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const links = linksByRole[user?.role] || [];

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <Link className="brand" to={roleDefaultPath(user.role)}>
        Felicity EMS
      </Link>
      <nav className="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <button type="button" className="btn danger" onClick={onLogout}>
        Logout
      </button>
    </header>
  );
}

export default Navbar;
