import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeMap: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/post': 'Create Post',
  '/scheduled': 'Scheduled Posts',
  '/analytics': 'Analytics',
  '/bulk-import': 'Bulk Import',
  '/url-shortener': 'URL Shortener',
  '/social-monitoring': 'Social Monitoring',
  '/calendar': 'Content Calendar',
  '/library': 'Content Library',
  '/ab-testing': 'A/B Testing',
  '/chatbot': 'AI Assistant',
  '/clips': 'Video Clipper',
  '/video-generator': 'Video Generator',
  '/admin': 'Admin',
};

export default function Breadcrumbs() {
  const location = useLocation();

  if (location.pathname === '/') return null;

  const pageLabel =
    routeMap[location.pathname] ||
    location.pathname
      .slice(1)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        fontSize: '0.8125rem',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'var(--color-textTertiary)',
          textDecoration: 'none',
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-textPrimary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-textTertiary)')}
      >
        <Home size={14} />
      </Link>
      <ChevronRight size={12} style={{ color: 'var(--color-textTertiary)' }} />
      <span style={{ color: 'var(--color-textSecondary)', fontWeight: 500 }}>{pageLabel}</span>
    </nav>
  );
}
