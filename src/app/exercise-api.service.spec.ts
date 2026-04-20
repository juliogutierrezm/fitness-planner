import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { ExerciseApiService } from './exercise-api.service';
import { AuthService } from './services/auth.service';
import { UserApiService } from './user-api.service';

describe('ExerciseApiService', () => {
  let service: ExerciseApiService;
  let httpMock: HttpTestingController;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'getCurrentUser',
      'getCurrentUserId',
      'canAccessUserData'
    ]);
    authServiceSpy.getCurrentUser.and.returnValue({ id: 'trainer-1', companyId: 'INDEPENDENT' } as any);
    authServiceSpy.getCurrentUserId.and.returnValue('trainer-1');
    authServiceSpy.canAccessUserData.and.returnValue(true);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ExerciseApiService,
        {
          provide: AuthService,
          useValue: authServiceSpy
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
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'description_es')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'exercise_type')).toBeFalse();
    req.flush({ ok: true });
  });

  it('normalizes exercise responses that use exerciseId instead of id', () => {
    let result: any;

    service.getExerciseById('test_1776031583190').subscribe(exercise => {
      result = exercise;
    });

    const req = httpMock.expectOne(`${environment.apiBase}/exercise/test_1776031583190`);
    expect(req.request.method).toBe('GET');
    req.flush({
      exerciseId: 'test_1776031583190',
      name_es: 'test 01',
      name_en: 'test',
      equipment_type: 'Barra',
      muscle_group: 'Bíceps',
      category: 'Complex',
      difficulty: 'Principiante',
      exercise_type: 'Test tipo',
      description_es: 'Test descripcion',
      tips: ['Test tips'],
      common_mistakes: ['Test errores'],
      video: null
    });

    expect(result.id).toBe('test_1776031583190');
    expect(result.exerciseId).toBe('test_1776031583190');
    expect(result.name).toBe('test 01');
    expect(result.equipment).toBe('Barra');
    expect(result.muscle).toBe('Bíceps');
    expect(result.description_es).toBe('Test descripcion');
    expect(result.tips).toEqual(['Test tips']);
    expect(result.video).toBeNull();
  });

  it('propagates 404 errors when loading a workout plan by id', () => {
    let receivedError: any;

    service.getWorkoutPlanById('plan-404').subscribe({
      next: () => fail('expected getWorkoutPlanById to error'),
      error: (error) => {
        receivedError = error;
      }
    });

    const req = httpMock.expectOne(`${environment.apiBase}/workoutPlans/plan-404`);
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });

    expect(receivedError?.status).toBe(404);
  });

  it('propagates 403 errors when loading a workout plan by id', () => {
    let receivedError: any;

    service.getWorkoutPlanById('plan-403').subscribe({
      next: () => fail('expected getWorkoutPlanById to error'),
      error: (error) => {
        receivedError = error;
      }
    });

    const req = httpMock.expectOne(`${environment.apiBase}/workoutPlans/plan-403`);
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    expect(receivedError?.status).toBe(403);
  });

  it('returns null before the request when there is no authenticated user id', () => {
    authServiceSpy.getCurrentUserId.and.returnValue(null);

    let result: any = 'pending';
    service.getWorkoutPlanById('plan-1').subscribe(value => {
      result = value;
    });

    expect(result).toBeNull();
    httpMock.expectNone(`${environment.apiBase}/workoutPlans/plan-1`);
  });
});
