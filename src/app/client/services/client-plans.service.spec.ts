import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ClientPlansService } from './client-data.service';
import { AuthService } from '../../services/auth.service';

describe('ClientPlansService', () => {
  const authServiceStub = {
    getCurrentUserId: () => 'user-1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceStub }
      ]
    });
  });

  it('should create', () => {
    const service = TestBed.inject(ClientPlansService);
    expect(service).toBeTruthy();
  });
});
