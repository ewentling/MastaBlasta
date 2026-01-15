import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Home, Users, Send, Calendar, Settings, Link2, TrendingUp, BarChart2, Upload, Folder, CalendarDays, Sparkles, MessageSquare, Scissors } from 'lucide-react';
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
import SettingsModal from './components/SettingsModal';
import { ThemeProvider } from './ThemeContext';
import { AIProvider } from './contexts/AIContext';
import './App.css';

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
];

function Navigation() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);

  const isActive = (path: string) => (location.pathname === path ? 'nav-link active' : 'nav-link');

  return (
    <>
      <nav className="sidebar">
        <div className="logo">
          <img src="/logo.png" alt="MastaBlasta" className="logo-image" />
        </div>
        <ul className="nav-menu">
          {appRoutes.map(({ path, label, icon: Icon }) => (
            <li key={path}>
              <Link to={path} className={isActive(path)}>
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <button className="settings-button" onClick={() => setShowSettings(true)}>
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </nav>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AIProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <div className="app-container">
              <Navigation />
              <main className="main-content">
                <Routes>
                  {appRoutes.map(({ path, element }) => (
                    <Route key={path} path={path} element={element} />
                  ))}
                </Routes>
              </main>
            </div>
          </Router>
        </QueryClientProvider>
      </AIProvider>
    </ThemeProvider>
  );
}

export default App;
