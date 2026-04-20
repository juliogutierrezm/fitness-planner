import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { UserApiService } from './user-api.service';

describe('UserApiService', () => {
  let service: UserApiService;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
    authServiceSpy.getCurrentUser.and.returnValue({ id: 'trainer-1', role: 'trainer', companyId: 'INDEPENDENT' } as any);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        UserApiService,
        {
          provide: AuthService,
          useValue: authServiceSpy
        }
      ]
    });

    service = TestBed.inject(UserApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts to resend-code for a user id', () => {
    let result: any;

    service.resendVerificationCode('abc').subscribe(value => {
      result = value;
    });

    const req = httpMock.expectOne(`${environment.apiBase}/users/abc/resend-code`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ok: true });

    expect(result).toEqual({ ok: true });
  });

  it('returns null without making a request when user id is missing', () => {
    let result: any = 'pending';

    service.resendVerificationCode('').subscribe(value => {
      result = value;
    });

    expect(result).toBeNull();
    httpMock.expectNone(`${environment.apiBase}/users//resend-code`);
  });

  it('returns null when resend-code request fails', () => {
    let result: any = 'pending';

    service.resendVerificationCode('abc').subscribe(value => {
      result = value;
    });

    const req = httpMock.expectOne(`${environment.apiBase}/users/abc/resend-code`);
    req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });
});
