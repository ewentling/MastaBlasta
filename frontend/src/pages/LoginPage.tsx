import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'google' | 'email'>('google');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
      return;
    }

    // Check for success message from registration
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }

    if (isInitialized.current || loginMethod !== 'google') return;

    const initializeGoogleOneTap = () => {
      if (window.google && googleButtonRef.current) {
        isInitialized.current = true;
        
        // Get Google Client ID from environment or use default for development
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        
        if (!clientId) {
          console.error('Google Client ID not configured');
          setError('Google authentication is not configured. Please contact the administrator.');
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: false,
        });

        // Render the Google Sign-In button
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 300,
          }
        );

        // Also show the One Tap prompt
        window.google.accounts.id.prompt();
      }
    };

    // If Google script is already loaded, initialize immediately
    if (window.google) {
      initializeGoogleOneTap();
    } else {
      // Otherwise, wait for the script to load
      const checkGoogleLoaded = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogleLoaded);
          initializeGoogleOneTap();
        }
      }, 100);

      return () => clearInterval(checkGoogleLoaded);
    }
  }, [isAuthenticated, navigate, loginMethod, location]);

  const handleGoogleResponse = async (response: { credential: string }) => {
    try {
      setError(null);
      await login(response.credential);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      setError('Login failed. Please try again or contact support if the problem persists.');
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store tokens and user info
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Reload page to trigger auth context update
      window.location.href = '/';
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="MastaBlasta" className="login-logo" />
          <h1>MastaBlasta</h1>
          <p>Multi-Platform Social Media Management</p>
        </div>

        <div className="login-content">
          <h2>Sign in to continue</h2>
          <p className="login-subtitle">Manage all your social media accounts in one place</p>

          {successMessage && (
            <div className="success-message" style={{
              padding: '12px',
              marginBottom: '20px',
              backgroundColor: '#e6f4ea',
              border: '1px solid #34a853',
              borderRadius: '8px',
              color: '#1e8e3e',
              fontSize: '14px'
            }}>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="error-message" style={{
              padding: '12px',
              marginBottom: '20px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '8px',
              color: '#c33',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* Login method toggle */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '24px',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setLoginMethod('google')}
              style={{
                padding: '8px 24px',
                backgroundColor: loginMethod === 'google' ? 'var(--color-accentPrimary)' : 'rgba(0, 229, 255, 0.1)',
                color: loginMethod === 'google' ? 'var(--color-bgPrimary)' : 'var(--text-primary)',
                border: '1px solid var(--color-accentPrimary)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
            >
              Google
            </button>
            <button
              onClick={() => setLoginMethod('email')}
              style={{
                padding: '8px 24px',
                backgroundColor: loginMethod === 'email' ? 'var(--color-accentPrimary)' : 'rgba(0, 229, 255, 0.1)',
                color: loginMethod === 'email' ? 'var(--color-bgPrimary)' : 'var(--text-primary)',
                border: '1px solid var(--color-accentPrimary)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
            >
              Email/Password
            </button>
          </div>

          {loginMethod === 'google' ? (
            <div className="google-signin-wrapper">
              <div ref={googleButtonRef} className="google-signin-button"></div>
            </div>
          ) : (
            <form onSubmit={handleEmailPasswordLogin} style={{ width: '100%', maxWidth: '400px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'var(--background)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: loading ? 'rgba(0, 229, 255, 0.3)' : 'linear-gradient(120deg, #00e5ff 0%, #00b3e6 40%, #7c4dff 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  boxShadow: loading ? 'none' : '0 10px 30px rgba(0, 229, 255, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Don't have an account?{' '}
                  <Link to="/register" style={{ color: 'var(--color-accentPrimary)', textDecoration: 'none', fontWeight: '600' }}>
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          )}

          <div className="login-features">
            <div className="feature">
              <span className="feature-icon">🚀</span>
              <span>Post to multiple platforms at once</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📅</span>
              <span>Schedule posts in advance</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📊</span>
              <span>Track analytics and engagement</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🤖</span>
              <span>AI-powered content generation</span>
            </div>
          </div>
        </div>

        <div className="login-footer">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
