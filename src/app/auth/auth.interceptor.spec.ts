import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['getIdToken', 'isLoggedIn']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true
        }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should add Authorization header for API requests when user is logged in', () => {
    const testToken = 'test.jwt.token';
    const apiUrl = `${environment.apiBase}/exercise`;
    
    authService.getIdToken.and.returnValue(testToken);
    authService.isLoggedIn.and.returnValue(true);

    httpClient.get(apiUrl).subscribe();

    const req = httpTestingController.expectOne(apiUrl);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${testToken}`);
  });

  it('should not add Authorization header for non-API requests', () => {
    const testToken = 'test.jwt.token';
    const nonApiUrl = 'https://external-api.com/data';
    
    authService.getIdToken.and.returnValue(testToken);
    authService.isLoggedIn.and.returnValue(true);

    httpClient.get(nonApiUrl).subscribe();

    const req = httpTestingController.expectOne(nonApiUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
  });

  it('should not add Authorization header when user is not logged in', () => {
    const apiUrl = `${environment.apiBase}/exercise`;
    
    authService.getIdToken.and.returnValue('test.token');
    authService.isLoggedIn.and.returnValue(false);

    httpClient.get(apiUrl).subscribe();

    const req = httpTestingController.expectOne(apiUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
  });

  it('should not add Authorization header when no token is available', () => {
    const apiUrl = `${environment.apiBase}/exercise`;
    
    authService.getIdToken.and.returnValue(null);
    authService.isLoggedIn.and.returnValue(false);

    httpClient.get(apiUrl).subscribe();

    const req = httpTestingController.expectOne(apiUrl);
    expect(req.request.headers.has('Authorization')).toBeFalse();
  });
});