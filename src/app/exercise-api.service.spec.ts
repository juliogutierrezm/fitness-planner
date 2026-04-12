import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { ExerciseApiService } from './exercise-api.service';
import { AuthService } from './services/auth.service';
import { UserApiService } from './user-api.service';

describe('ExerciseApiService', () => {
  let service: ExerciseApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ExerciseApiService,
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => ({ id: 'trainer-1', companyId: 'INDEPENDENT' }),
            getCurrentUserId: () => 'trainer-1'
          }
        },
        {
          provide: UserApiService,
          useValue: {}
        }
      ]
    });

    service = TestBed.inject(ExerciseApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('includes video null explicitly when requested', () => {
    service.createExercise({
      id: 'exercise-1',
      name_en: 'Push Up',
      name_es: 'Lagartija',
      equipment_type: 'Bodyweight',
      muscle_group: 'Chest',
      category: 'Strength',
      video: null
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/exercise`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.video).toBeNull();
    expect(req.request.body.functional).toBeUndefined();
    req.flush({ ok: true });
  });

  it('omits video when the property is not provided', () => {
    service.createExercise({
      id: 'exercise-2',
      name_en: 'Squat',
      name_es: 'Sentadilla',
      equipment_type: 'Bodyweight',
      muscle_group: 'Legs',
      category: 'Strength'
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/exercise`);
    expect(req.request.method).toBe('POST');
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'video')).toBeFalse();
    req.flush({ ok: true });
  });
});
