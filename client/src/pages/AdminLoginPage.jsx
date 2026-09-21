import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { login } from '../services/api';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Users } from 'lucide-react';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.data.user.role !== 'admin') {
        showToast('This account does not have admin access.', 'error');
        return;
      }
      showToast('Welcome back! Redirecting to admin dashboard...', 'success');
      loginUser(res.data.token, res.data.user);
      setTimeout(() => navigate('/'), 600);
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Invalid email or password. Please try again.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split">
      <div className="login-split__container">
        {/* Left branding panel */}
        <div className="login-split__brand login-split__brand--admin">
          <img
            src="/white-emcy-logo.png"
            alt="EMC Youth"
            className="login-brand__white-logo"
          />
          <div className="login-brand__title">Admin Portal</div>
          <div className="login-brand__subtitle">
            Management &amp; oversight dashboard - monitor team performance and manage resources.
          </div>
          <div className="login-brand__dots">
            <span /><span /><span />
          </div>
        </div>

        {/* Right form panel */}
        <div className="login-split__form-side">
          <div className="login-form__heading">Admin Portal</div>
          <div className="login-form__subheading">
            Sign in with your administrator credentials
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-form__group">
              <input
                id="admin-login-email"
                type="email"
                className="login-form__input"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Mail size={18} className="login-form__icon" />
              <label htmlFor="admin-login-email" className="login-form__label">
                Admin Email
              </label>
            </div>

            <div className="login-form__group">
              <input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-form__input"
                placeholder=" "
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Lock size={18} className="login-form__icon" />
              <label htmlFor="admin-login-password" className="login-form__label">
                Password
              </label>
              <button
                type="button"
                className="login-form__toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              id="admin-login-submit"
              type="submit"
              className="login-form__btn login-form__btn--admin"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="login-form__spinner" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In as Admin
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-form__divider">
            <span>or</span>
          </div>

          <Link to="/login" className="login-form__alt-link login-form__alt-link--admin">
            <Users size={14} />
            Team Member Login
          </Link>

          <div className="login-form__footer">
            EMCY Dashboard &copy; {new Date().getFullYear()} &middot; <span>Admin Access Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
