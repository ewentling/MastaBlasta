import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
}

const routeMap: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/create-post': 'Create Post',
  '/scheduled-posts': 'Scheduled Posts',
  '/analytics': 'Analytics',
  '/bulk-import': 'Bulk Import',
  '/url-shortener': 'URL Shortener',
  '/social-monitoring': 'Social Monitoring',
  '/content-calendar': 'Content Calendar',
  '/content-library': 'Content Library',
  '/ab-testing': 'A/B Testing',
  '/ai-assistant': 'AI Assistant',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Dashboard', path: '/' },
  ];

  let currentPath = '';
  pathnames.forEach((segment) => {
    currentPath += `/${segment}`;
    const label = routeMap[currentPath] || segment.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    breadcrumbs.push({ label, path: currentPath });
  });

  if (breadcrumbs.length === 1) {
    return null; // Don't show breadcrumbs on home page
  }

  return (
    <nav className="flex items-center space-x-2 text-sm mb-4">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <React.Fragment key={crumb.path}>
            {index === 0 ? (
              <Link
                to={crumb.path}
                className="flex items-center text-gray-400 hover:text-gray-200 transition-colors"
              >
                <Home className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                {isLast ? (
                  <span className="text-gray-200 font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-gray-400 hover:text-gray-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
