import { useState, useEffect, useRef, Component } from 'react';
import type { CSSProperties } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Home, Users, Send, Calendar, Settings, Link2, TrendingUp, BarChart2, Upload, Folder, CalendarDays, Sparkles, MessageSquare, Scissors, LogOut, Shield, AlertTriangle, RefreshCw, Palette, Video, ChevronLeft, ChevronRight, Menu, X, Briefcase, Building2, Lightbulb, Repeat, Zap, Inbox, Clock, Hash } from 'lucide-react';
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
import VideoGeneratorPage from './pages/VideoGeneratorPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SubscriptionInfoPage from './pages/SubscriptionInfoPage';
import CampaignsPage from './pages/CampaignsPage';
import WorkspacesPage from './pages/WorkspacesPage';
import PostIdeasPage from './pages/PostIdeasPage';
import AutoEngagementPage from './pages/AutoEngagementPage';
import ContentRecyclingPage from './pages/ContentRecyclingPage';
import SmartQueuePage from './pages/SmartQueuePage';
import LinkInBioPage from './pages/LinkInBioPage';
import UnifiedInboxPage from './pages/UnifiedInboxPage';
import TrendingPage from './pages/TrendingPage';
import SettingsModal from './components/SettingsModal';
import NotificationCenter from './components/NotificationCenter';
import Breadcrumbs from './components/Breadcrumbs';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from './components/KeyboardShortcuts';
import { ToastProvider } from './components/Toast';
import { ThemeProvider, useTheme, themes } from './ThemeContext';
import type { ThemeName } from './ThemeContext';
import { AIProvider } from './contexts/AIContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { accountsApi } from './api';
import type { Account } from './types';
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
  element: React.ReactElement;
  adminOnly?: boolean;
};

export const appRoutes: AppRouteConfig[] = [
  { path: '/', label: 'Dashboard', icon: Home, element: <DashboardPage /> },
  { path: '/accounts', label: 'Accounts', icon: Users, element: <AccountsPage /> },
  { path: '/post', label: 'Create Post', icon: Send, element: <PostPage /> },
  { path: '/scheduled', label: 'Scheduled Posts', icon: Calendar, element: <ScheduledPostsPage /> },
  { path: '/smart-queue', label: 'Smart Queue', icon: Clock, element: <SmartQueuePage /> },
  { path: '/inbox', label: 'Unified Inbox', icon: Inbox, element: <UnifiedInboxPage /> },
  { path: '/analytics', label: 'Analytics', icon: BarChart2, element: <AnalyticsPage /> },
  { path: '/bulk-import', label: 'Bulk Import', icon: Upload, element: <BulkImportPage /> },
  { path: '/url-shortener', label: 'URL Shortener', icon: Link2, element: <URLShortenerPage /> },
  { path: '/link-in-bio', label: 'Link-in-Bio', icon: Link2, element: <LinkInBioPage /> },
  { path: '/trending', label: 'Trending', icon: Hash, element: <TrendingPage /> },
  { path: '/social-monitoring', label: 'Social Monitoring', icon: TrendingUp, element: <SocialMonitoringPage /> },
  { path: '/calendar', label: 'Content Calendar', icon: CalendarDays, element: <ContentCalendarPage /> },
  { path: '/library', label: 'Content Library', icon: Folder, element: <ContentLibraryPage /> },
  { path: '/campaigns', label: 'Campaigns', icon: Briefcase, element: <CampaignsPage /> },
  { path: '/workspaces', label: 'Workspaces', icon: Building2, element: <WorkspacesPage /> },
  { path: '/post-ideas', label: 'AI Post Ideas', icon: Lightbulb, element: <PostIdeasPage /> },
  { path: '/auto-engagement', label: 'Auto-Engagement', icon: Zap, element: <AutoEngagementPage /> },
  { path: '/content-recycling', label: 'Content Recycling', icon: Repeat, element: <ContentRecyclingPage /> },
  { path: '/ab-testing', label: 'A/B Testing', icon: Sparkles, element: <ABTestingPage /> },
  { path: '/chatbot', label: 'AI Assistant', icon: MessageSquare, element: <ChatbotPage /> },
  { path: '/clips', label: 'Video Clipper', icon: Scissors, element: <ClipsPage /> },
  { path: '/video-generator', label: 'Video Generator', icon: Video, element: <VideoGeneratorPage /> },
  { path: '/admin', label: 'Admin', icon: Shield, element: <AdminPage />, adminOnly: true },
];

// ── UX #4: Scroll to top on route change ──────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Scroll the main content area to top
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

// ── UX #9: Avatar for sidebar user info ───────────────────────────────────
function SidebarAvatar({ name, email }: { name?: string; email: string }) {
  const initials = name
    ? name.split(' ').filter(w => w).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase();
  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
  const bg = colors[email.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
      boxShadow: `0 2px 8px ${bg}55`,
    }}>{initials}</div>
  );
}

function Navigation() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const { logout, user } = useAuth();
  const { themeName, setTheme } = useTheme();
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts();

  // UX #3: Collapsible sidebar
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  };

  // UX #10: Mobile sidebar
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Fetch connected account count for badge
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.getAll(),
    staleTime: 60_000,
  });
  const connectedCount = (accountsData?.accounts ?? []).filter((a: Account) => a.enabled).length;

  const isActive = (path: string) => (location.pathname === path ? 'nav-link active' : 'nav-link');

  const handleLogout = () => { logout(); };

  const isAdmin = user?.role === 'admin';

  const themeAccents: Record<ThemeName, string> = {
    dark: '#667eea',
    synthwave: '#ff006e',
    pixel: '#f4845f',
    crt: '#00ff41',
    neon: '#00d9ff',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    borderRadius: '9px',
    background: 'var(--color-accentPrimary)',
    color: '#000',
    fontSize: '11px',
    fontWeight: '700',
    lineHeight: 1,
    marginLeft: 'auto',
    flexShrink: 0,
  };

  return (
    <>
      {/* UX #10: Mobile hamburger */}
      <button className="hamburger-btn" onClick={() => setMobileOpen(true)}>
        <Menu size={22} />
      </button>
      {mobileOpen && <div className="sidebar-overlay visible" onClick={() => setMobileOpen(false)} />}

      <nav className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        {/* UX #3: Collapse toggle */}
        <button className="sidebar-toggle" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="logo">
          <img src="/logo.png" alt="MastaBlasta" className="logo-image" />
        </div>
        <ul className="nav-menu">
          {appRoutes.filter(route => !route.adminOnly || isAdmin).map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <Link to={path} className={isActive(path)} title={collapsed ? label : undefined} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Icon size={20} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {path === '/accounts' && connectedCount > 0 && (
                  <span style={badgeStyle}>{connectedCount}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          {/* UX #9: Avatar + user info */}
          {user && (
            <div className="user-info" style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <SidebarAvatar name={user.name} email={user.email} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              </div>
            </div>
          )}

          {/* Theme quick-switcher */}
          <div className="sidebar-theme-picker" style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setShowThemePicker(v => !v)}
              className="settings-button"
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Palette size={18} />
                <span style={{ fontSize: '0.875rem' }}>Theme</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-textSecondary)' }}>{themes[themeName].displayName}</span>
            </button>
            {showThemePicker && (
              <div style={{ display: 'flex', gap: '8px', padding: '8px 4px 4px', flexWrap: 'wrap' }}>
                {(Object.entries(themeAccents) as [ThemeName, string][]).map(([name, color]) => (
                  <button
                    key={name}
                    title={themes[name].displayName}
                    onClick={() => { setTheme(name); setShowThemePicker(false); }}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      border: themeName === name ? `3px solid white` : '3px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      boxShadow: themeName === name ? `0 0 8px ${color}` : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <NotificationCenter />
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
      <KeyboardShortcutsHelp show={showHelp} onClose={() => setShowHelp(false)} shortcuts={shortcuts} />
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--color-accentPrimary, #00e5ff)' }} />
        <p style={{ color: 'var(--color-textSecondary, #94a3b8)', fontSize: '0.9375rem' }}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: '#f59e0b' }} />
        <h2 style={{ color: 'var(--color-textPrimary)', fontSize: '1.5rem', fontWeight: '700' }}>Access Denied</h2>
        <p style={{ color: 'var(--color-textSecondary)', maxWidth: '400px' }}>You do not have permission to access the admin panel.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// ── UX #1: Page transition wrapper ────────────────────────────────────────
function PageTransition({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <div className="page-transition" key={pathname}>{children}</div>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AIProvider>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
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
                              <ScrollToTop />
                              <Breadcrumbs />
                              <ErrorBoundary>
                                <PageTransition>
                                  <Routes>
                                    {appRoutes.map(({ path, element, adminOnly }) => (
                                      <Route
                                        key={path}
                                        path={path}
                                        element={adminOnly ? <AdminRoute>{element}</AdminRoute> : element}
                                      />
                                    ))}
                                  </Routes>
                                </PageTransition>
                              </ErrorBoundary>
                            </main>
                          </div>
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </Router>
              </ToastProvider>
            </QueryClientProvider>
          </AIProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
