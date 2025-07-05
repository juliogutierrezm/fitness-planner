// src/app/shared/exercise-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Exercise, Session } from './shared/models';

@Injectable({ providedIn: 'root' })
export class ExerciseApiService {
  private sessionsKey = 'fp_sessions';
  private backendUrl  = 'https://k2ok2k1ft9.execute-api.us-east-1.amazonaws.com/dev/exercise';

  constructor(private http: HttpClient) {}

  // =============== CUSTOM EXERCISES CRUD ===============
  getExercises(): Observable<Exercise[]> {
    return this.http.get<Exercise[]>(this.backendUrl).pipe(
      tap(exs => console.log('📋 Ejercicios obtenidos:', exs)),
      catchError(err => {
        console.error('❌ Error al obtener ejercicios:', err);
        return of([]);
      })
    );
  }

  createExercise(ex: Exercise): Observable<any> {
    return this.http.post(this.backendUrl, ex).pipe(
      tap(() => console.log('✅ Ejercicio creado:', ex)),
      catchError(err => {
        console.error('❌ Error al crear ejercicio:', err);
        return of(null);
      })
    );
  }

  updateExercise(ex: Exercise): Observable<any> {
    return this.http.put(this.backendUrl, ex).pipe(
      tap(() => console.log('✏️ Ejercicio actualizado:', ex)),
      catchError(err => {
        console.error('❌ Error al actualizar ejercicio:', err);
        return of(null);
      })
    );
  }

  deleteExercise(id: string): Observable<any> {
    return this.http.delete(`${this.backendUrl}?id=${id}`).pipe(
      tap(() => console.log(`🗑️ Ejercicio eliminado ${id}`)),
      catchError(err => {
        console.error('❌ Error al eliminar ejercicio:', err);
        return of(null);
      })
    );
  }

  bulkInsert(exs: Exercise[]): Observable<any> {
    const url = `${this.backendUrl}/bulk`;
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

  // =============== SESSION STORAGE PARA PLANNER ===============
  loadSessions(): Session[] {
    const s = localStorage.getItem(this.sessionsKey);
    return s ? JSON.parse(s) : [];
  }
  saveSessions(sessions: Session[]) {
    localStorage.setItem(this.sessionsKey, JSON.stringify(sessions));
  }
}
