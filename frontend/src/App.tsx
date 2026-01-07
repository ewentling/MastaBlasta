import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home, Users, Send, Calendar } from 'lucide-react';
import AccountsPage from './pages/AccountsPage';
import PostPage from './pages/PostPage';
import ScheduledPostsPage from './pages/ScheduledPostsPage';
import DashboardPage from './pages/DashboardPage';
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
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'nav-link active' : 'nav-link';
  };

  return (
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
      </ul>
    </nav>
  );
}

function App() {
  return (
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
            </Routes>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
