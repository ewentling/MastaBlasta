import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App, { appRoutes } from './App';

// Mock the api module so tests don't rely on a running backend
vi.mock('./api', async (importOriginal) => {
const actual = await importOriginal<typeof import('./api')>();
return {
...actual,
api: {
...actual.api,
get: vi.fn().mockRejectedValue({ response: { status: 401 } }),
interceptors: actual.api.interceptors,
},
};
});

describe('App navigation', () => {
beforeEach(() => {
localStorage.clear();
});

it('shows login page when user is not authenticated', async () => {
render(<App />);
// When not logged in, ProtectedRoute redirects to /login after auth check
await waitFor(() => {
expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
});
});

it('routes array has unique paths', () => {
const uniquePaths = new Set(appRoutes.map(route => route.path));
expect(uniquePaths.size).toBe(appRoutes.length);
});

it('admin route is marked as adminOnly', () => {
const adminRoute = appRoutes.find(route => route.path === '/admin');
expect(adminRoute).toBeDefined();
expect(adminRoute?.adminOnly).toBe(true);
});

it('non-admin routes do not have adminOnly flag', () => {
const nonAdminRoutes = appRoutes.filter(route => route.path !== '/admin');
nonAdminRoutes.forEach(route => {
expect(route.adminOnly).toBeFalsy();
});
});
});
