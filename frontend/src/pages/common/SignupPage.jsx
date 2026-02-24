import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  participantType: 'iiit',
  collegeName: '',
  contactNumber: '',
};

function SignupPage() {
  const navigate = useNavigate();
  const { signupParticipant } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signupParticipant(form);
      navigate('/participant/onboarding', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-card wide">
        <h1>Participant Registration</h1>
        <p className="muted">
          IIIT participants must use IIIT email domain. Non-IIIT participants can use any valid email.
          College/organization and contact number are required.
        </p>

        <form onSubmit={submit} className="form-grid">
          <label>
            First Name
            <input
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              required
            />
          </label>
          <label>
            Last Name
            <input
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              required
            />
          </label>
          <label>
            Participant Type
            <select
              value={form.participantType}
              onChange={(e) => setForm((p) => ({ ...p, participantType: e.target.value }))}
            >
              <option value="iiit">IIIT Student</option>
              <option value="non_iiit">Non-IIIT Participant</option>
            </select>
          </label>
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
              minLength={8}
              required
            />
          </label>
          <label>
            College/Organization Name
            <input
              value={form.collegeName}
              onChange={(e) => setForm((p) => ({ ...p, collegeName: e.target.value }))}
              required
            />
          </label>
          <label>
            Contact Number
            <input
              value={form.contactNumber}
              onChange={(e) => setForm((p) => ({ ...p, contactNumber: e.target.value }))}
              required
            />
          </label>

          {error ? <p className="error full">{error}</p> : null}

          <button type="submit" className="btn full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Participant Account'}
          </button>
        </form>

        <p className="muted">
          Already registered? <Link to="/login">Back to login</Link>
        </p>
      </section>
    </div>
  );
}

export default SignupPage;
