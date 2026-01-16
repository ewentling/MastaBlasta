import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

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
  const { login, isAuthenticated } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
      return;
    }

    if (isInitialized.current) return;

    const initializeGoogleOneTap = () => {
      if (window.google && googleButtonRef.current) {
        isInitialized.current = true;
        
        // Get Google Client ID from environment or use default for development
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        
        if (!clientId) {
          console.error('Google Client ID not configured');
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
  }, [isAuthenticated, navigate]);

  const handleGoogleResponse = async (response: { credential: string }) => {
    try {
      await login(response.credential);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please try again.');
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
          <h2>Sign in to continue</h2>
          <p className="login-subtitle">Manage all your social media accounts in one place</p>

          <div className="google-signin-wrapper">
            <div ref={googleButtonRef} className="google-signin-button"></div>
          </div>

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
