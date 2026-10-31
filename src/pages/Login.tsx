import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import logo from '../assets/logo.png';
import cover from '../assets/cover_photo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-cover">
      <img className="cover-art" src={cover} alt="" aria-hidden="true" />
      <div className="cover-shade" aria-hidden="true" />

      <div className="cover-statement">
        <h2>Every furlong, accounted for.</h2>
        <p>Stable, string, and race day, managed from one place.</p>
      </div>

      <form className="login-plaque" onSubmit={handleSubmit}>
        <img className="brand-mark" src={logo} alt="Stayblz logo" />
        <h1>Stayblz</h1>
        <p className="login-sub">Sign in to your racing operations dashboard</p>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="superadmin"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="dev-note">
          Development build — use <code>superadmin</code> / <code>staybliz123</code>
        </p>
      </form>
    </div>
  );
}
