import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './LoginPage.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:33766';

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordRequirements = [
    'At least 8 characters long',
    'At least 1 uppercase letter',
    'At least 1 lowercase letter',
    'At least 1 number',
    'At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.full_name
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Registration successful - redirect to login
      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <h2>Create your account</h2>
          <p className="login-subtitle">Join MastaBlasta to manage all your social media in one place</p>

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

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="full_name" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
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

            <div style={{ marginBottom: '16px' }}>
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

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
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

            <div style={{ marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <p style={{ marginBottom: '8px', fontWeight: '500' }}>Password requirements:</p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                {passwordRequirements.map((req, index) => (
                  <li key={index} style={{ marginBottom: '4px' }}>{req}</li>
                ))}
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#4285f4', textDecoration: 'none', fontWeight: '500' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="login-footer">
          <p>By creating an account, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
