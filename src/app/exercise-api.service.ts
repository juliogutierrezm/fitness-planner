// src/app/shared/exercise-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { Exercise, Session, AiPlanRequest, PollingResponse, AiStep, VideoSource } from './shared/models';
import { AuthService } from './services/auth.service';
import { environment } from '../environments/environment';
import { UserApiService } from './user-api.service';
import { sanitizeName, isGymMode } from './shared/shared-utils';

// Allowed fields for exercise updates
const ALLOWED_FIELDS = [
  "name_es",
  "difficulty",
  "category",
  "equipment_type",
  "muscle_group",
  "secondary_muscles",
  "exercise_type",
  "training_goal",
  "common_mistakes",
  "tips",
  "description_es",
  "aliases",
  "video"
];

// Protected fields that must be excluded from update payloads
const PROTECTED_FIELDS = [
  "id",
  "name_en",
  "s3_key",
  "preview_url",
  "thumbnail",
  "process_status",
  "processed_ai",
  "created_at",
  "updated_at"
];

interface ExerciseLibraryResponse {
  count: number;
  items: Exercise[];
}

@Injectable({ providedIn: 'root' })
export class ExerciseApiService {
  private apiBase     = environment.apiBase;
  private exerciseUrl = `${this.apiBase}/exercise`;
  private exerciseLibUrl = `${this.apiBase}/exercise/library`;
  private planUrl     = `${this.apiBase}/workoutPlans`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private userApi: UserApiService
  ) {}

  private getSessionsKey(): string {
    const userId = this.authService.getCurrentUserId();
    return userId ? `fp_sessions_${userId}` : 'fp_sessions_anonymous';
  }

  private buildLegacyVideoSource(exercise: Partial<Exercise> & Record<string, any>): VideoSource | null {
    if (Object.prototype.hasOwnProperty.call(exercise, 'video')) {
      return exercise.video ?? null;
    }

    const youtubeUrl = exercise.youtube_url || exercise.video?.youtubeUrl;
    if (youtubeUrl) {
      return {
        type: 'YOUTUBE',
        youtubeUrl,
        thumbnailUrl: exercise.thumbnail || exercise.thumbnailUrl || exercise.video?.thumbnailUrl
      };
    }

    const previewUrl = exercise.preview_url || exercise.previewUrl || exercise.video?.previewUrl;
    if (previewUrl) {
      return {
        type: 'S3',
        previewUrl,
        thumbnailUrl: exercise.thumbnail || exercise.thumbnailUrl || exercise.video?.thumbnailUrl
      };
    }

    return null;
  }

  private normalizeExercise(exercise: Partial<Exercise> & Record<string, any>): Exercise {
    const id = exercise.id || exercise.exerciseId || '';
    const nameEs = exercise.name_es || exercise.name || exercise.name_en || '';
    const nameEn = exercise.name_en || exercise.name || exercise.name_es || '';

    return {
      ...exercise,
      id,
      exerciseId: exercise.exerciseId || id,
      name: exercise.name || nameEs || nameEn || id,
      name_es: nameEs,
      name_en: nameEn,
      equipment: exercise.equipment || exercise.equipment_type || '',
      equipment_type: exercise.equipment_type || exercise.equipment || '',
      muscle: exercise.muscle || exercise.muscle_group || '',
      muscle_group: exercise.muscle_group || exercise.muscle || '',
      preview_url: exercise.preview_url || exercise.previewUrl || exercise.video?.previewUrl,
      previewUrl: exercise.previewUrl || exercise.preview_url || exercise.video?.previewUrl,
      thumbnail: exercise.thumbnail || exercise.thumbnailUrl || exercise.video?.thumbnailUrl,
      thumbnailUrl: exercise.thumbnailUrl || exercise.thumbnail || exercise.video?.thumbnailUrl,
      youtube_url: exercise.youtube_url || exercise.video?.youtubeUrl,
      video: this.buildLegacyVideoSource(exercise)
    } as Exercise;
  }

  // =============== EXERCISES CRUD ===============
  private sanitizeExerciseUpdatePayload(exercise: Exercise): any {
    // Filter to only allowed fields and warn about protected fields
    const sanitized = Object.fromEntries(
      Object.entries(exercise).filter(([key]) => ALLOWED_FIELDS.includes(key))
    );

    const foundProtected = Object.keys(exercise).filter(key =>
      PROTECTED_FIELDS.includes(key)
    );

    if (foundProtected.length > 0) {
      console.warn('🚨 Protected fields detected (removed from payload):', foundProtected);
    }

    return sanitized; // Return only allowed fields, no id since it's in URL
  }

  getExerciseLibrary(): Observable<ExerciseLibraryResponse> {
    return this.http.get<ExerciseLibraryResponse>(this.exerciseLibUrl).pipe(
      map(res => ({
        ...res,
        items: (res.items || []).map(item => this.normalizeExercise(item as any))
      })),
      tap(res => console.log('📋 Biblioteca de ejercicios obtenida:', res.count, 'ejercicios')),
      catchError(err => {
        console.error('❌ Error al obtener biblioteca de ejercicios:', err);
        return of({ count: 0, items: [] });
      })
    );
  }

  getAllExercises(): Observable<Exercise[]> {
    return this.http.get<ExerciseLibraryResponse>(this.exerciseUrl).pipe(
      map(res => (res.items || []).map(item => this.normalizeExercise(item as any))),
      tap(exercises => console.log('📋 Ejercicios combinados obtenidos:', exercises.length)),
      catchError(err => {
        console.error('❌ Error al obtener ejercicios combinados:', err);
        return of([]);
      })
    );
  }

  updateExerciseLibraryItem(id: string, exercise: Exercise): Observable<{ok: boolean, updated: Partial<Exercise>}> {
    const payload = this.sanitizeExerciseUpdatePayload(exercise);
    const url = `${this.exerciseLibUrl}/${encodeURIComponent(id)}`;
    console.log('🌐 REQUEST BODY:', JSON.stringify(payload, null, 2));
    console.log('🌐 REQUEST URL:', url);
    console.log('🌐 UPDATE URL:', url);
    return this.http.put<{ok: boolean, updated: Partial<Exercise>}>(url, payload).pipe(
      tap(res => console.log('✏️ Ejercicio de libreria actualizado:', res.ok ? 'Éxito' : 'Falló', res.updated)),
      catchError(err => {
        console.error('❌ Error al actualizar ejercicio de libreria:', err);
        return of({ ok: false, updated: {} });
      })
    );
  }

  getExercises(): Observable<Exercise[]> {
    return this.getAllExercises();
  }

  // Lambda-based exercise creation
  createExercise(exerciseData: {
    id?: string;
    name_en: string;
    name_es?: string;
    equipment_type: string;
    muscle_group: string;
    category: string;
    description_en?: string;
    description_es?: string;
    exercise_type?: string;
    difficulty?: string;
    movement_pattern?: string;
    training_goal?: string;
    aliases?: string[];
    secondary_muscles?: string[];
    tips?: string[];
    common_mistakes?: string[];
    video?: VideoSource | null;
  }): Observable<any> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return of(null);
    }

    // Generate ID from name_en
    const id = exerciseData.id || `${sanitizeName(exerciseData.name_en)}_${Date.now()}`;

    // Build payload - NEVER use legacy fields (preview_url, s3_key, thumbnail)
    const payload: any = {
      id,
      name_en: exerciseData.name_en,
      name_es: exerciseData.name_es || exerciseData.name_en,
      equipment_type: exerciseData.equipment_type,
      muscle_group: exerciseData.muscle_group,
      category: exerciseData.category,
      difficulty: exerciseData.difficulty || ''
    };

    if (exerciseData.description_en?.trim()) payload.description_en = exerciseData.description_en.trim();
    if (exerciseData.description_es?.trim()) payload.description_es = exerciseData.description_es.trim();
    if (exerciseData.exercise_type?.trim()) payload.exercise_type = exerciseData.exercise_type.trim();
    if (exerciseData.movement_pattern?.trim()) payload.movement_pattern = exerciseData.movement_pattern.trim();
    if (exerciseData.training_goal?.trim()) payload.training_goal = exerciseData.training_goal.trim();

    // Handle arrays
    if (exerciseData.aliases?.length) payload.aliases = exerciseData.aliases;
    if (exerciseData.secondary_muscles?.length) payload.secondary_muscles = exerciseData.secondary_muscles;
    if (exerciseData.tips?.length) payload.tips = exerciseData.tips;
    if (exerciseData.common_mistakes?.length) payload.common_mistakes = exerciseData.common_mistakes;

    // Owner resolution - NEVER send both, NEVER send none
    if (user.companyId && user.companyId !== 'INDEPENDENT') {
      payload.companyId = user.companyId;
    } else {
      payload.trainerId = user.id;
    }

    // Video - only if provided
    if (Object.prototype.hasOwnProperty.call(exerciseData, 'video')) {
      payload.video = exerciseData.video;
    }

    console.log('🌐 REQUEST BODY:', JSON.stringify(payload, null, 2));
    console.log('🌐 REQUEST URL:', this.exerciseUrl);

    return this.http.post(`${this.apiBase}/exercise`, payload).pipe(
      tap(() => console.log('✅ Ejercicio creado:', id)),
      catchError(err => {
        console.error('❌ Error al crear ejercicio:', err);
        return of(null);
      })
    );
  }

  // Get presigned URL for video upload
  getUploadUrl(filename: string, contentType: string): Observable<any> {
    const payload = {
      action: 'getUploadUrl',
      filename: filename,
      contentType: contentType
    };

    return this.http.post(`${this.apiBase}/exercise`, payload).pipe(
      tap(res => console.log('🔗 URL de subida obtenida:', res)),
      catchError(err => {
        console.error('❌ Error al obtener URL de subida:', err);
        return of(null);
      })
    );
  }

  // Get a single exercise by ID
  getExerciseById(id: string): Observable<Exercise | null> {
    const url = `${this.exerciseUrl}/${encodeURIComponent(id)}`;
    return this.http.get<Exercise>(url).pipe(
      map(ex => ex ? this.normalizeExercise(ex as any) : null),
      tap(ex => console.log('📋 Ejercicio obtenido:', ex?.id)),
      catchError(err => {
        console.error('❌ Error al obtener ejercicio por ID:', err);
        return of(null);
      })
    );
  }

  // Check video processing status
  getVideoStatus(s3Key: string): Observable<{ ready: boolean; previewUrl?: string; thumbnailUrl?: string }> {
    const params = encodeURIComponent(s3Key);
    return this.http.get<{ ready: boolean; previewUrl?: string; thumbnailUrl?: string }>(
      `${this.apiBase}/video-status?s3_key=${params}`
    ).pipe(
      tap(res => console.log('🎬 Video status:', res)),
      catchError(err => {
        console.error('❌ Error checking video status:', err);
        return of({ ready: false });
      })
    );
  }

  updateExercise(ex: Exercise): Observable<any> {
    const updateUrl = `${this.exerciseUrl}/${encodeURIComponent(ex.id)}`;

    // ✅ USAR MISMO SANITIZE QUE LIBRARY
    const payload = this.sanitizeExerciseUpdatePayload(ex);

    console.log('🌐 CLEAN UPDATE PAYLOAD:', JSON.stringify(payload, null, 2));

    return this.http.put(updateUrl, payload).pipe(
      tap(() => console.log('✏️ Ejercicio actualizado:', payload)),
      catchError(err => {
        console.error('❌ Error al actualizar ejercicio:', err);
        return of(null);
      })
    );
  }

  deleteExercise(id: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/exercise/${encodeURIComponent(id)}`).pipe(
      tap(() => console.log(`🗑️ Ejercicio eliminado ${id}`)),
      catchError(err => {
        console.error('❌ Error al eliminar ejercicio:', err);
        return of(null);
      })
    );
  }

  bulkInsert(exs: Exercise[]): Observable<any> {
    const url = `${this.exerciseUrl}/bulk`;
    const batchSize = 25;
    const calls = [];
    for (let i = 0; i < exs.length; i += batchSize) {
      calls.push(
        this.http.post(url, exs.slice(i, i + batchSize)).pipe(
          catchError(err => {
            console.error('❌ Error en batch:', err);
            return of(null);
          })
        )
      );
    }
    return forkJoin(calls);
  }

  // =============== WORKOUT PLANS ===============
  /**
   * Purpose: persist a new workout plan for the current or specified user.
   * Input: plan payload with identifiers and sessions. Output: Observable of save response.
   * Error handling: logs and returns null when user is unauthenticated.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  saveWorkoutPlan(plan: {
    planId: string;
    name: string;
    date: string;
    sessions: Session[];
    generalNotes?: string;
    objective?: string;
    userId?: string;
  }): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('? Usuario no autenticado');
      return of(null);
    }

    const fullPlan = {
      ...plan,
      userId: plan.userId || currentUser.id,
      companyId: currentUser.companyId || 'INDEPENDENT',
      trainerId: currentUser.role === 'trainer' ? currentUser.id : undefined
    };

    return this.http.post(`${this.planUrl}`, fullPlan).pipe(
      tap(() => console.log('?? Plan de entrenamiento guardado', fullPlan)),
      catchError(err => {
        console.error('? Error al guardar plan:', err);
        return of(null);
      })
    );
  }

  /**
   * Purpose: fetch workout plans for a user with permission validation.
   * Input: optional userId. Output: Observable of plan list.
   * Error handling: logs and returns empty list on failures.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getWorkoutPlansByUser(userId?: string): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('? Usuario no autenticado');
      return of([]);
    }

    // If no userId provided, get plans for current user
    const targetUserId = userId || currentUser.id;

    // Check permissions
    if (!this.authService.canAccessUserData(targetUserId)) {
      console.error('? No tienes permisos para acceder a estos datos');
      return of([]);
    }

    const byUserUrl = `${this.apiBase}/users/plan?userId=${encodeURIComponent(targetUserId)}&id=${encodeURIComponent(targetUserId)}`;
    return this.http.get<any[]>(byUserUrl).pipe(
      tap(plans => console.log('?? Planes obtenidos (users/:id/plan):', plans)),
      catchError(err => {
        console.warn('Fallo users/:id/plan, intentando /workoutPlans?userId', err);
        return this.http.get<any[]>(`${this.planUrl}?userId=${encodeURIComponent(targetUserId)}`).pipe(
          catchError(err2 => {
            console.error('? Error al obtener planes por usuario:', err2);
            return of([]);
          })
        );
      })
    );
  }

  getWorkoutPlanById(planId: string): Observable<any> {
    const userId = this.authService.getCurrentUserId();
    // Check permissions
    if (!userId || !this.authService.canAccessUserData(userId)) {
      console.error('❌ No tienes permisos para acceder a estos datos');
      return of(null);
    }

    return this.http.get<any>(`${this.planUrl}/${planId}`).pipe(
      tap(plan => console.log(`📦 Plan obtenido ${planId}:`, plan)),
      catchError(err => {
        console.error(`❌ Error al obtener el plan ${planId}:`, err);
        return of(null);
      })
    );
  }

  /**
   * Purpose: update an existing workout plan for its original user only.
   * Input: plan object with planId and userId. Output: Observable of update result.
   * Error handling: logs and returns null when identifiers or permissions are invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  updateWorkoutPlan(plan: any): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('? Usuario no autenticado');
      return of(null);
    }

    if (!plan?.userId) {
      console.error('? updateWorkoutPlan requiere userId');
      return of(null);
    }

    if (!plan?.planId) {
      console.error('? updateWorkoutPlan requiere planId');
      return of(null);
    }

    return this.http.put(`${this.planUrl}`, plan).pipe(
      tap(() => console.log('?? Plan de entrenamiento actualizado', plan)),
      catchError(err => {
        console.error('? Error al actualizar plan:', err);
        return of(null);
      })
    );
  }

  deleteWorkoutPlan(planId: string): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ Usuario no autenticado');
      return of(null);
    }

    if (!planId) {
      console.error('❌ planId requerido para eliminar');
      return of(null);
    }

    return this.http.delete(`${this.planUrl}/${encodeURIComponent(planId)}`).pipe(
      tap(() => console.log('✅ Plan de entrenamiento eliminado', planId)),
      catchError(err => {
        console.error('❌ Error al eliminar plan:', err);
        return of(null);
      })
    );
  }

generateWorkoutPlanAI(promptOrParams: string | any): Observable<any> {
  const url = `${this.apiBase}/generatePlanFromAI`;

  // Support both legacy string prompt and new flat object format
  const payload = typeof promptOrParams === 'string'
    ? { prompt: promptOrParams }
    : promptOrParams;

  return this.http.post(url, payload).pipe(
    tap(plan => console.log('🧠 Plan generado por IA:', plan)),
    catchError(err => {
      console.error('❌ Error al generar plan IA:', err);
      return of(null);
    })
  );
}

// New method for parameterized AI plan generation
generatePlanFromAI(params: AiPlanRequest): Observable<{ executionId: string }> {
  return this.http.post<{ executionId: string }>(
    `${this.apiBase}/generatePlanFromAI`,
    params
  ).pipe(
    tap(response => console.log('🚀 Plan generation started with executionId:', response.executionId)),
    catchError(err => {
      console.error('❌ Error starting plan generation:', err);
      throw err;
    })
  );
}

// Polling method for plan generation status - uses userId
pollPlanGeneration(userId: string): Observable<PollingResponse> {
  return this.http.get<PollingResponse>(
    `${this.apiBase}/generatePlanFromAI/${userId}`
  );
}

pollPlanByExecution(
  userId: string,
  executionId: string
): Observable<PollingResponse> {
  return this.http.get<PollingResponse>(
    `${this.apiBase}/generatePlanFromAI/${userId}/${executionId}`
  );
}


// Polling method to get generated plan
getGeneratedPlan(executionArn: string): Observable<any> {
  const params = encodeURIComponent(executionArn);
  return this.http.get<any>(
    `${this.apiBase}/generatePlanFromAI?executionArn=${params}`
  ).pipe(
    tap(res => console.log('📊 Polling plan status:', res.status)),
    catchError(err => {
      console.error('❌ Error polling plan:', err);
      return of({ status: 'failed' });
    })
  );
}

getWorkoutPlanFromAI(userId: string): Observable<any> {
  return this.http.get<any>(
    `${this.apiBase}/generatePlanFromAI/${userId}`
  );
}

// REMOVED: getAiProgress - forbidden method
// REMOVED: getLatestPlan - forbidden method


  // =============== ADMIN/TRAINER AGGREGATES ===============
  getPlansByTrainer(trainerId?: string): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return of([]);
    const url = trainerId
      ? `${this.planUrl}/trainer?trainerId=${encodeURIComponent(trainerId)}`
      : `${this.planUrl}/trainer`;
    return this.http.get<any[]>(url).pipe(
      tap(list => console.log('Planes por entrenador:', list?.length || 0)),
      catchError(err => {
        console.error('Error al obtener planes por entrenador:', err);
        return of([]);
      })
    );
  }

  getPlansByCompany(companyId?: string): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return of([]);
    const url = companyId
      ? `${this.planUrl}/company?companyId=${encodeURIComponent(companyId)}`
      : `${this.planUrl}/company`;
    return this.http.get<any[]>(url).pipe(
      tap(list => console.log('Planes por compañía:', list?.length || 0)),
      catchError(err => {
        console.error('Error al obtener planes por compañía:', err);
        return of([]);
      })
    );
  }

  /**
   * Purpose: fetch workout plans for the current tenant using gym vs independent mode.
   * Input: none. Output: Observable<any[]>.
   * Error handling: returns empty list when user or identifiers are missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getPlansForCurrentTenant(): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return of([]);
    const companyId = currentUser.companyId || 'INDEPENDENT';
    if (isGymMode(companyId)) {
      return this.getPlansByCompany(companyId);
    }
    if (!currentUser.id) return of([]);
    return this.userApi.getWorkoutPlansByUserId(currentUser.id);
  }



  // =============== SESSION STORAGE ===============
  loadSessions(): Session[] {
    const key = this.getSessionsKey();
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  }

  saveSessions(sessions: Session[]) {
    const key = this.getSessionsKey();
    localStorage.setItem(key, JSON.stringify(sessions));
  }

  // Clear sessions for current user
  clearUserSessions() {
    const key = this.getSessionsKey();
    localStorage.removeItem(key);
  }
}

