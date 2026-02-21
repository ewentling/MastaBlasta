import { useState, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Home, Users, Send, Calendar, Settings, Link2, TrendingUp, BarChart2, Upload, Folder, CalendarDays, Sparkles, MessageSquare, Scissors, LogOut, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import AccountsPage from './pages/AccountsPage';
import PostPage from './pages/PostPage';
import ScheduledPostsPage from './pages/ScheduledPostsPage';
import DashboardPage from './pages/DashboardPage';
import URLShortenerPage from './pages/URLShortenerPage';
import SocialMonitoringPage from './pages/SocialMonitoringPage';
import AnalyticsPage from './pages/AnalyticsPage';
import BulkImportPage from './pages/BulkImportPage';
import ContentCalendarPage from './pages/ContentCalendarPage';
import ContentLibraryPage from './pages/ContentLibraryPage';
import ABTestingPage from './pages/ABTestingPage';
import ChatbotPage from './pages/ChatbotPage';
import ClipsPage from './pages/ClipsPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SubscriptionInfoPage from './pages/SubscriptionInfoPage';
import SettingsModal from './components/SettingsModal';
import { ThemeProvider } from './ThemeContext';
import { AIProvider } from './contexts/AIContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// ==================== Error Boundary ====================
interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={48} style={{ color: '#f59e0b' }} />
          <h2 style={{ color: 'var(--color-textPrimary)', fontSize: '1.5rem', fontWeight: '700' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-textSecondary)', maxWidth: '400px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', background: 'linear-gradient(120deg,#00e5ff,#7c4dff)', border: 'none', borderRadius: '0.5rem', color: 'white', fontWeight: '600', cursor: 'pointer' }}
          >
            <RefreshCw size={16} /> Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

type AppRouteConfig = {
  path: string;
  label: string;
  icon: LucideIcon;
  element: JSX.Element;
  adminOnly?: boolean;
};

export const appRoutes: AppRouteConfig[] = [
  { path: '/', label: 'Dashboard', icon: Home, element: <DashboardPage /> },
  { path: '/accounts', label: 'Accounts', icon: Users, element: <AccountsPage /> },
  { path: '/post', label: 'Create Post', icon: Send, element: <PostPage /> },
  { path: '/scheduled', label: 'Scheduled Posts', icon: Calendar, element: <ScheduledPostsPage /> },
  { path: '/analytics', label: 'Analytics', icon: BarChart2, element: <AnalyticsPage /> },
  { path: '/bulk-import', label: 'Bulk Import', icon: Upload, element: <BulkImportPage /> },
  { path: '/url-shortener', label: 'URL Shortener', icon: Link2, element: <URLShortenerPage /> },
  { path: '/social-monitoring', label: 'Social Monitoring', icon: TrendingUp, element: <SocialMonitoringPage /> },
  { path: '/calendar', label: 'Content Calendar', icon: CalendarDays, element: <ContentCalendarPage /> },
  { path: '/library', label: 'Content Library', icon: Folder, element: <ContentLibraryPage /> },
  { path: '/ab-testing', label: 'A/B Testing', icon: Sparkles, element: <ABTestingPage /> },
  { path: '/chatbot', label: 'AI Assistant', icon: MessageSquare, element: <ChatbotPage /> },
  { path: '/clips', label: 'Video Clipper', icon: Scissors, element: <ClipsPage /> },
  { path: '/admin', label: 'Admin', icon: Shield, element: <AdminPage />, adminOnly: true },
];

function Navigation() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const { logout, user } = useAuth();

  const isActive = (path: string) => (location.pathname === path ? 'nav-link active' : 'nav-link');

  const handleLogout = () => {
    logout();
  };

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <nav className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="MastaBlasta" className="logo-image" />
        </div>
        <ul className="nav-menu">
          {appRoutes.filter(route => !route.adminOnly || isAdmin).map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <Link to={path} className={isActive(path)}>
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          {user && (
            <div className="user-info" style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.name}</div>
              <div style={{ fontSize: '12px' }}>{user.email}</div>
            </div>
          )}
          <button className="settings-button" onClick={() => setShowSettings(true)}>
            <Settings size={20} />
            <span>Settings</span>
          </button>
          <button className="settings-button" onClick={handleLogout} style={{ color: '#ff4444' }}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </nav>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--color-accentPrimary, #00e5ff)' }} />
        <p style={{ color: 'var(--color-textSecondary, #94a3b8)', fontSize: '0.9375rem' }}>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AIProvider>
            <QueryClientProvider client={queryClient}>
              <Router>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/subscription-info" element={<SubscriptionInfoPage />} />
                  <Route
                    path="*"
                    element={
                      <ProtectedRoute>
                        <div className="app-container">
                          <Navigation />
                          <main className="main-content">
                            <ErrorBoundary>
                              <Routes>
                                {appRoutes.map(({ path, element }) => (
                                  <Route key={path} path={path} element={element} />
                                ))}
                              </Routes>
                            </ErrorBoundary>
                          </main>
                        </div>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Router>
            </QueryClientProvider>
          </AIProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
