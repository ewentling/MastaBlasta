import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App, { appRoutes } from './App';

describe('App navigation', () => {
	it('shows login page when user is not authenticated', () => {
		render(<App />);
		// When not logged in, ProtectedRoute redirects to /login
		expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
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
