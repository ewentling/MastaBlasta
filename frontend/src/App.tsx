import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home, Users, Send, Calendar, Settings, Link2, TrendingUp } from 'lucide-react';
import AccountsPage from './pages/AccountsPage';
import PostPage from './pages/PostPage';
import ScheduledPostsPage from './pages/ScheduledPostsPage';
import DashboardPage from './pages/DashboardPage';
import URLShortenerPage from './pages/URLShortenerPage';
import SocialMonitoringPage from './pages/SocialMonitoringPage';
import SettingsModal from './components/SettingsModal';
import { ThemeProvider } from './ThemeContext';
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
                <Route path="/url-shortener" element={<URLShortenerPage />} />
                <Route path="/social-monitoring" element={<SocialMonitoringPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
