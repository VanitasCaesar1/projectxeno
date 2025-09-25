import { vi } from 'vitest';

// Mock environment variables
vi.mock('astro:env', () => ({
  TMDB_API_KEY: 'test-api-key'
}));

// Mock import.meta.env for Supabase
Object.defineProperty(import.meta, 'env', {
  value: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-anon-key'
  },
  writable: true
});

// Setup DOM environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    search: '',
    pathname: '/'
  },
  writable: true
});

// Mock fetch globally
global.fetch = vi.fn();