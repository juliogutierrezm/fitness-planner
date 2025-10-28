import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService, User } from './auth.service';
import { mockLocalStorage, mockLocation, createMockJWT, createExpiredMockJWT } from './test-utils';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    // Mock browser APIs
    mockLocalStorage();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null for getIdToken when no token stored', () => {
    expect(service.getIdToken()).toBeNull();
  });

  it('should return null for getAccessToken when no token stored', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('should return null for getUser when no user stored', () => {
    expect(service.getUser()).toBeNull();
  });

  it('should return false for isLoggedIn when no token stored', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should store and retrieve id token', () => {
    const testToken = 'test.jwt.token';
    localStorage.setItem('id_token', testToken);
    
    expect(service.getIdToken()).toBe(testToken);
  });

  it('should store and retrieve access token', () => {
    const testToken = 'test.access.token';
    localStorage.setItem('access_token', testToken);
    
    expect(service.getAccessToken()).toBe(testToken);
  });

  it('should return true for isLoggedIn with valid token', () => {
    const testToken = createMockJWT();
    localStorage.setItem('id_token', testToken);
    
    expect(service.isLoggedIn()).toBeTrue();
  });

  it('should return false for isLoggedIn with expired token', () => {
    const expiredToken = createExpiredMockJWT();
    localStorage.setItem('id_token', expiredToken);
    
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('should store and retrieve user info', () => {
    const testUser: User = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    localStorage.setItem('user_info', JSON.stringify(testUser));
    localStorage.setItem('id_token', 'dummy.token');
    
    // Create new service instance to test initialization
    const newService = TestBed.inject(AuthService);
    expect(newService.getUser()).toEqual(testUser);
  });

  it('should redirect to Cognito on login', () => {
    // Spy on window.location.href
    const originalHref = window.location.href;
    let mockHref = '';
    
    Object.defineProperty(window.location, 'href', {
      get: () => mockHref,
      set: (value) => { mockHref = value; },
      configurable: true
    });
    
    service.login();
    
    expect(mockHref).toContain('oauth2/authorize');
    expect(mockHref).toContain('response_type=code');
    expect(mockHref).toContain('scope=email');
    
    // Restore
    Object.defineProperty(window.location, 'href', {
      value: originalHref,
      writable: true,
      configurable: true
    });
  });

  it('should clear storage on logout', () => {
    // Setup some stored data
    localStorage.setItem('id_token', 'test-token');
    localStorage.setItem('user_info', JSON.stringify({ id: 'test', email: 'test@test.com', name: 'Test' }));
    
    // Mock location.href for logout test
    const originalHref = window.location.href;
    let mockHref = '';
    
    Object.defineProperty(window.location, 'href', {
      get: () => mockHref,
      set: (value) => { mockHref = value; },
      configurable: true
    });
    
    service.logout();
    
    expect(localStorage.getItem('id_token')).toBeNull();
    expect(localStorage.getItem('user_info')).toBeNull();
    expect(service.getUser()).toBeNull();
    expect(mockHref).toContain('/logout');
    
    // Restore
    Object.defineProperty(window.location, 'href', {
      value: originalHref,
      writable: true,
      configurable: true
    });
  });

  it('should emit user changes via observable', () => {
    let currentUser: User | null = null;
    
    service.user$.subscribe(user => {
      currentUser = user;
    });
    
    expect(currentUser).toBeNull();
    
    // Simulate user login by setting localStorage and creating new service
    const testUser: User = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    localStorage.setItem('user_info', JSON.stringify(testUser));
    localStorage.setItem('id_token', 'dummy.token');
    
    const newService = TestBed.inject(AuthService);
    newService.user$.subscribe(user => {
      currentUser = user;
    });
    
    expect(currentUser).toEqual(jasmine.objectContaining(testUser));
  });
});