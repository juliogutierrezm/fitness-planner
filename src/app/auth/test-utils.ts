/**
 * Test utilities for mocking browser APIs in unit tests
 */

export class MockStorage implements Storage {
  private data: { [key: string]: string } = {};

  get length(): number {
    return Object.keys(this.data).length;
  }

  clear(): void {
    this.data = {};
  }

  getItem(key: string): string | null {
    return this.data[key] || null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.data);
    return keys[index] || null;
  }

  removeItem(key: string): void {
    delete this.data[key];
  }

  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
}

export class MockLocation {
  href = '';
  
  constructor(href = 'http://localhost:4200') {
    this.href = href;
  }
}

/**
 * Mock localStorage for tests
 */
export function mockLocalStorage(): MockStorage {
  const mockStorage = new MockStorage();
  
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true
  });
  
  return mockStorage;
}

/**
 * Mock window.location for tests
 */
export function mockLocation(initialHref = 'http://localhost:4200'): MockLocation {
  const mockLoc = new MockLocation(initialHref);
  
  // Only try to mock if not already mocked
  if (!('__isMocked' in window.location)) {
    try {
      Object.defineProperty(window, 'location', {
        value: { ...mockLoc, __isMocked: true },
        writable: true,
        configurable: true
      });
    } catch (e) {
      // If we can't redefine, just update the href
      (window.location as any).href = initialHref;
    }
  }
  
  return mockLoc;
}

/**
 * Create a valid JWT token for testing
 */
export function createMockJWT(payload: any = {}, expiresInSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const defaultPayload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    exp: now + expiresInSeconds,
    iat: now,
    ...payload
  };

  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = btoa(JSON.stringify(defaultPayload));
  const signature = 'mock-signature';

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Create an expired JWT token for testing
 */
export function createExpiredMockJWT(payload: any = {}): string {
  return createMockJWT(payload, -3600); // Expired 1 hour ago
}