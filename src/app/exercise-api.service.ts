// src/app/shared/exercise-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { Exercise, Session } from './shared/models';
import { AuthService } from './services/auth.service';

@Injectable({ providedIn: 'root' })
export class ExerciseApiService {
  private apiBase     = 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev';
  private exerciseUrl = `${this.apiBase}/exercise`;
  private planUrl     = `${this.apiBase}/workoutPlans`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getSessionsKey(): string {
    const userId = this.authService.getCurrentUserId();
    return userId ? `fp_sessions_${userId}` : 'fp_sessions_anonymous';
  }

  // =============== EXERCISES CRUD ===============
  getExercises(): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.exerciseUrl).pipe(
      tap(exs => console.log('📋 Ejercicios obtenidos:', exs)),
      catchError(err => {
        console.error('❌ Error al obtener ejercicios:', err);
        return of([]);
      })
    );
  }

  createExercise(ex: Exercise): Observable<any> {
    return this.http.post(this.exerciseUrl, ex).pipe(
      tap(() => console.log('✅ Ejercicio creado:', ex)),
      catchError(err => {
        console.error('❌ Error al crear ejercicio:', err);
        return of(null);
      })
    );
  }

  updateExercise(ex: Exercise): Observable<any> {
    return this.http.put(this.exerciseUrl, ex).pipe(
      tap(() => console.log('✏️ Ejercicio actualizado:', ex)),
      catchError(err => {
        console.error('❌ Error al actualizar ejercicio:', err);
        return of(null);
      })
    );
  }

  deleteExercise(id: string): Observable<any> {
    return this.http.delete(`${this.exerciseUrl}?id=${id}`).pipe(
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
  saveWorkoutPlan(plan: {
    planId: string;
    name: string;
    date: string;
    sessions: Session[];
    generalNotes?: string;
  }): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ Usuario no autenticado');
      return of(null);
    }

    const fullPlan = {
      ...plan,
      userId: currentUser.id,
      companyId: currentUser.companyId || 'INDEPENDENT',
      trainerId: currentUser.role === 'trainer' ? currentUser.id : undefined
    };

    return this.http.post(`${this.planUrl}`, fullPlan).pipe(
      tap(() => console.log('💾 Plan de entrenamiento guardado', fullPlan)),
      catchError(err => {
        console.error('❌ Error al guardar plan:', err);
        return of(null);
      })
    );
  }

  getWorkoutPlansByUser(userId?: string): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ Usuario no autenticado');
      return of([]);
    }

    // If no userId provided, get plans for current user
    const targetUserId = userId || currentUser.id;

    // Check permissions
    if (!this.authService.canAccessUserData(targetUserId)) {
      console.error('❌ No tienes permisos para acceder a estos datos');
      return of([]);
    }

    return this.http.get<any[]>(`${this.planUrl}?userId=${targetUserId}`).pipe(
      tap(plans => console.log('📦 Planes obtenidos:', plans)),
      catchError(err => {
        console.error('❌ Error al obtener planes:', err);
        return of([]);
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

  updateWorkoutPlan(plan: any): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ Usuario no autenticado');
      return of(null);
    }

    // Check permissions
    if (!this.authService.canAccessUserData(plan.userId)) {
      console.error('❌ No tienes permisos para actualizar estos datos');
      return of(null);
    }

    return this.http.put(`${this.planUrl}`, plan).pipe(
      tap(() => console.log('💾 Plan de entrenamiento actualizado', plan)),
      catchError(err => {
        console.error('❌ Error al actualizar plan:', err);
        return of(null);
      })
    );
  }

generateWorkoutPlanAI(prompt: string): Observable<any> {
  const url = `${this.apiBase}/generatePlanFromAI`;
  return this.http.post(url, { prompt }).pipe(
    tap(plan => console.log('🧠 Plan generado por IA:', plan)),
    catchError(err => {
      console.error('❌ Error al generar plan IA:', err);
      return of(null);
    })
  );
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
