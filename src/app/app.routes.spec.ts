import { routes } from './app.routes';

describe('public routes', () => {
  it('exposes login but not public registration', () => {
    expect(routes.some((route) => route.path === 'login')).toBe(true);
    expect(routes.some((route) => route.path === 'register')).toBe(false);
  });
});
