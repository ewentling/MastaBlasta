import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App, { appRoutes } from './App';

describe('App navigation', () => {
	it('renders navigation links for each configured route', () => {
		render(<App />);

		appRoutes.forEach(route => {
			expect(screen.getByRole('link', { name: route.label })).toBeInTheDocument();
		});
	});

	it('routes array and rendered links remain in sync', () => {
		const uniquePaths = new Set(appRoutes.map(route => route.path));
		expect(uniquePaths.size).toBe(appRoutes.length);
	});
});
