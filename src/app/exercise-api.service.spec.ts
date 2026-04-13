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
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'description_en')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'description_es')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'exercise_type')).toBeFalse();
    expect(Object.prototype.hasOwnProperty.call(req.request.body, 'training_goal')).toBeFalse();
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
      training_goal: 'Test objetivo',
      tips: ['Test tips'],
      common_mistakes: ['Test errores'],
      secondary_muscles: ['Test musculos'],
      aliases: ['Test variaciones'],
      video: null
    });

    expect(result.id).toBe('test_1776031583190');
    expect(result.exerciseId).toBe('test_1776031583190');
    expect(result.name).toBe('test 01');
    expect(result.equipment).toBe('Barra');
    expect(result.muscle).toBe('Bíceps');
    expect(result.description_es).toBe('Test descripcion');
    expect(result.training_goal).toBe('Test objetivo');
    expect(result.tips).toEqual(['Test tips']);
    expect(result.video).toBeNull();
  });
});
