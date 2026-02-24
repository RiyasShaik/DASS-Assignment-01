import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { requestOrganizerReset } from '../../api/auth';
import { roleDefaultPath, useAuth } from '../../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetForm, setResetForm] = useState({ email: '', reason: '' });
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const session = await login(form);
      const fallback = roleDefaultPath(session.user.role);
      const from = location.state?.from?.pathname;
      navigate(from || fallback, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetLoading(true);

    try {
      const res = await requestOrganizerReset(resetForm);
      setResetSuccess(res.message || 'Request submitted. Admin will review it shortly.');
      setResetForm({ email: '', reason: '' });
    } catch (err) {
      setResetError(err?.response?.data?.message || 'Failed to submit reset request');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <h1>Felicity Event Management</h1>
        <p className="muted">Login with your participant, organizer, or admin credentials.</p>

        <form onSubmit={submit} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <p className="muted">
          Participant? <Link to="/signup">Create account</Link>
        </p>

        <p className="muted">
          <button
            type="button"
            className="btn ghost"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
            onClick={() => setShowReset((prev) => !prev)}
          >
            {showReset ? 'Hide' : 'Organizer forgot password?'}
          </button>
        </p>

        {showReset ? (
          <form onSubmit={submitReset} className="form-stack" style={{ marginTop: '0.5rem' }}>
            <label>
              Organizer Login Email
              <input
                type="email"
                value={resetForm.email}
                onChange={(e) => setResetForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Your organizer login email"
                required
              />
            </label>
            <label>
              Reason for Reset
              <textarea
                rows={2}
                value={resetForm.reason}
                onChange={(e) => setResetForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Forgot password, account locked..."
                required
              />
            </label>

            {resetError ? <p className="error">{resetError}</p> : null}
            {resetSuccess ? <p className="success">{resetSuccess}</p> : null}

            <button type="submit" className="btn ghost" disabled={resetLoading}>
              {resetLoading ? 'Submitting...' : 'Submit Reset Request'}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

export default LoginPage;

