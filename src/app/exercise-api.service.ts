// src/app/shared/exercise-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Exercise, Session } from './shared/models';

@Injectable({ providedIn: 'root' })
export class ExerciseApiService {
  private sessionsKey = 'fp_sessions';

  private apiBase     = 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev';
  private exerciseUrl = `${this.apiBase}/exercise`;
  private planUrl     = `${this.apiBase}/workoutPlans`;

  constructor(private http: HttpClient) {}

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
    userId: string;
    name: string;
    companyId?: string;
    date: string;
    sessions: Session[];
  }): Observable<any> {
    return this.http.post(`${this.planUrl}`, plan).pipe(
      tap(() => console.log('💾 Plan de entrenamiento guardado', plan)),
      catchError(err => {
        console.error('❌ Error al guardar plan:', err);
        return of(null);
      })
    );
  }

  getWorkoutPlansByUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.planUrl}?userId=${userId}`).pipe(
      tap(plans => console.log('📦 Planes obtenidos:', plans)),
      catchError(err => {
        console.error('❌ Error al obtener planes:', err);
        return of([]);
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
    const s = localStorage.getItem(this.sessionsKey);
    return s ? JSON.parse(s) : [];
  }

  saveSessions(sessions: Session[]) {
    localStorage.setItem(this.sessionsKey, JSON.stringify(sessions));
  }
}
