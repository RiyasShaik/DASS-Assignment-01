import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { roleDefaultPath, useAuth } from './context/AuthContext';

import LoginPage from './pages/common/LoginPage';
import SignupPage from './pages/common/SignupPage';
import NotFoundPage from './pages/common/NotFoundPage';
import ParticipantOnboardingPage from './pages/participant/ParticipantOnboardingPage';

import ParticipantDashboardPage from './pages/participant/ParticipantDashboardPage';
import BrowseEventsPage from './pages/participant/BrowseEventsPage';
import ParticipantEventDetailsPage from './pages/participant/ParticipantEventDetailsPage';
import ParticipantProfilePage from './pages/participant/ParticipantProfilePage';
import OrganizersListPage from './pages/participant/OrganizersListPage';
import OrganizerDetailPage from './pages/participant/OrganizerDetailPage';

import OrganizerDashboardPage from './pages/organizer/OrganizerDashboardPage';
import CreateEventPage from './pages/organizer/CreateEventPage';
import OngoingEventsPage from './pages/organizer/OngoingEventsPage';
import OrganizerEventDetailsPage from './pages/organizer/OrganizerEventDetailsPage';
import OrganizerProfilePage from './pages/organizer/OrganizerProfilePage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ManageOrganizersPage from './pages/admin/ManageOrganizersPage';
import PasswordResetRequestsPage from './pages/admin/PasswordResetRequestsPage';

function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={roleDefaultPath(user.role)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route element={<ProtectedRoute roles={['participant']} />}>
        <Route element={<AppLayout />}>
          <Route path="/participant/dashboard" element={<ParticipantDashboardPage />} />
          <Route path="/participant/onboarding" element={<ParticipantOnboardingPage />} />
          <Route path="/participant/events" element={<BrowseEventsPage />} />
          <Route path="/participant/events/:eventId" element={<ParticipantEventDetailsPage />} />
          <Route path="/participant/organizers" element={<OrganizersListPage />} />
          <Route path="/participant/organizers/:organizerId" element={<OrganizerDetailPage />} />
          <Route path="/participant/profile" element={<ParticipantProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['organizer']} />}>
        <Route element={<AppLayout />}>
          <Route path="/organizer/dashboard" element={<OrganizerDashboardPage />} />
          <Route path="/organizer/events/new" element={<CreateEventPage />} />
          <Route path="/organizer/events/ongoing" element={<OngoingEventsPage />} />
          <Route path="/organizer/events/:eventId" element={<OrganizerEventDetailsPage />} />
          <Route path="/organizer/profile" element={<OrganizerProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/organizers" element={<ManageOrganizersPage />} />
          <Route path="/admin/reset-requests" element={<PasswordResetRequestsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['participant', 'organizer', 'admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
