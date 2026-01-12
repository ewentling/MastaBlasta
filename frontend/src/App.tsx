import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home, Users, Send, Calendar, Settings, Link2, TrendingUp, BarChart2, Upload, Folder, CalendarDays, Sparkles, MessageSquare } from 'lucide-react';
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

function Navigation() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  return (
    <>
      <nav className="sidebar">
        <div className="logo">
          <h1>🚀 MastaBlasta</h1>
          <p>Multi-Platform Posting</p>
        </div>
        <ul className="nav-menu">
          <li>
            <Link to="/" className={isActive('/')}>
              <Home size={20} />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link to="/accounts" className={isActive('/accounts')}>
              <Users size={20} />
              <span>Accounts</span>
            </Link>
          </li>
          <li>
            <Link to="/post" className={isActive('/post')}>
              <Send size={20} />
              <span>Create Post</span>
            </Link>
          </li>
          <li>
            <Link to="/scheduled" className={isActive('/scheduled')}>
              <Calendar size={20} />
              <span>Scheduled Posts</span>
            </Link>
          </li>
          <li>
            <Link to="/analytics" className={isActive('/analytics')}>
              <BarChart2 size={20} />
              <span>Analytics</span>
            </Link>
          </li>
          <li>
            <Link to="/bulk-import" className={isActive('/bulk-import')}>
              <Upload size={20} />
              <span>Bulk Import</span>
            </Link>
          </li>
          <li>
            <Link to="/url-shortener" className={isActive('/url-shortener')}>
              <Link2 size={20} />
              <span>URL Shortener</span>
            </Link>
          </li>
          <li>
            <Link to="/social-monitoring" className={isActive('/social-monitoring')}>
              <TrendingUp size={20} />
              <span>Social Monitoring</span>
            </Link>
          </li>
          <li>
            <Link to="/calendar" className={isActive('/calendar')}>
              <CalendarDays size={20} />
              <span>Content Calendar</span>
            </Link>
          </li>
          <li>
            <Link to="/library" className={isActive('/library')}>
              <Folder size={20} />
              <span>Content Library</span>
            </Link>
          </li>
          <li>
            <Link to="/ab-testing" className={isActive('/ab-testing')}>
              <Sparkles size={20} />
              <span>A/B Testing</span>
            </Link>
          </li>
          <li>
            <Link to="/chatbot" className={isActive('/chatbot')}>
              <Sparkles size={20} />
              <span>AI Assistant</span>
            </Link>
          </li>
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
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/post" element={<PostPage />} />
                  <Route path="/scheduled" element={<ScheduledPostsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/bulk-import" element={<BulkImportPage />} />
                  <Route path="/url-shortener" element={<URLShortenerPage />} />
                  <Route path="/social-monitoring" element={<SocialMonitoringPage />} />
                  <Route path="/calendar" element={<ContentCalendarPage />} />
                  <Route path="/library" element={<ContentLibraryPage />} />
                  <Route path="/ab-testing" element={<ABTestingPage />} />
                  <Route path="/chatbot" element={<ChatbotPage />} />
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
