import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="page-wrap">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
