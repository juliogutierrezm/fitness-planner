import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { AuthService, UserRole } from './services/auth.service';

export interface AppUser {
  id?: string;
  email: string;
  givenName?: string;
  familyName?: string;
  telephone?: string;
  gender?: string;      // Gender: 'Masculino', 'Femenino', 'Otro', 'Prefiero no decirlo'
  role: 'client' | 'trainer' | 'admin';
  companyId?: string;
  trainerId?: string; // owner trainer for independent trainers
  dateOfBirth?: string; // ISO format: YYYY-MM-DD
  noInjuries?: boolean;  // true if user explicitly has NO injuries
  injuries?: string;    // Free text, optional (null when noInjuries=true)
  notes?: string;       // Trainer internal notes, optional
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private base = `${environment.apiBase}/users`;
  constructor(private http: HttpClient, private auth: AuthService) {}

  canCreateUsers(): boolean {
    const u = this.auth.getCurrentUser();
    if (!u) return false;
    // Entrenadores (con o sin compañía) y Admin pueden crear usuarios
    if (u.role === UserRole.TRAINER) return true;
    if (u.role === UserRole.ADMIN) return true;
    return false;
  }

  createUser(payload: AppUser): Observable<any> {
    const u = this.auth.getCurrentUser();
    if (!u) return of(null);
    // Enforce server-side relevant ownership fields
    const body: any = { ...payload };
    if (u.role === UserRole.TRAINER) {
      // Entrenador crea clientes. Asignar siempre trainerId, y companyId si el entrenador pertenece a una compañía
      body.role = 'client';
      body.trainerId = u.id;
      // companyId requerido por GSI2 del backend: usar el del entrenador o 'INDEPENDENT'
      body.companyId = u.companyId || 'INDEPENDENT';
    }
    // Sanitizar otros posibles nulos (companyId ya está normalizado)
    if (!body.trainerId) delete body.trainerId;
    if (!body.givenName) delete body.givenName;
    if (!body.familyName) delete body.familyName;
    if (!body.createdAt) delete body.createdAt;
    return this.http.post(this.base, body).pipe(
      tap(res => console.log('User created', res)),
      catchError(err => { console.error('Create user error', err); return of(null); })
    );
  }

  getUsersByTrainer(trainerId?: string): Observable<AppUser[]> {
    const u = this.auth.getCurrentUser();
    if (!u) return of([]);
    const id = trainerId || u.id;
    return this.http.get<AppUser[]>(`${this.base}?trainerId=${encodeURIComponent(id)}`).pipe(
      catchError(err => { console.error('getUsersByTrainer error', err); return of([]); })
    );
  }

  getUsersByCompany(companyId?: string): Observable<AppUser[]> {
    const u = this.auth.getCurrentUser();
    if (!u || u.role !== UserRole.ADMIN) return of([]);
    const id = companyId || (u.companyId || '');
    if (!id) return of([]);
    return this.http.get<AppUser[]>(`${this.base}?companyId=${encodeURIComponent(id)}`).pipe(
      catchError(err => { console.error('getUsersByCompany error', err); return of([]); })
    );
  }

  updateUser(user: AppUser): Observable<any> {
    if (!user?.id) { console.error('updateUser requires id'); return of(null); }
    return this.http.put(`${this.base}/${encodeURIComponent(user.id)}`, user).pipe(
      catchError(err => { console.error('updateUser error', err); return of(null); })
    );
  }

  deleteUser(userId: string): Observable<any> {
    if (!userId) return of(null);
    return this.http.delete(`${this.base}/${encodeURIComponent(userId)}`).pipe(
      catchError(err => { console.error('deleteUser error', err); return of(null); })
    );
  }

getUserById(userId: string): Observable<AppUser | null> {
  if (!userId) return of(null);

  const url = `${this.base}/${encodeURIComponent(userId)}`;
  console.log('getUserById URL:', url);

  return this.http.get<any>(url).pipe(
    map(res => {
      // Caso 1: backend ya devuelve el usuario directo
      if (res && !res.body && res.id) {
        return res as AppUser;
      }

      // Caso 2: API Gateway proxy { statusCode, body }
      if (res && typeof res.body === 'string') {
        try {
          return JSON.parse(res.body) as AppUser;
        } catch {
          return null;
        }
      }

      return null;
    }),
    catchError(err => {
      console.error('getUserById error', err);
      return of(null);
    })
  );
}



  getWorkoutPlansByUserId(userId: string): Observable<any[]> {
    if (!userId) return of([]);
    const url = `${this.base}/plan?userId=${encodeURIComponent(userId)}`;
    return this.http.get<any>(url).pipe(
      // Normaliza respuesta de API Gateway proxy ({ statusCode, body }) o lista directa
      // y hace fallback a /workoutPlans?userId cuando no hay arreglo.
      // Evita romper la UI con (list || []).slice cuando no es array.
      // 1) Si es array, úsalo.
      // 2) Si trae body, intenta parsear JSON y extraer arreglo.
      // 3) Si mensaje indica parámetro faltante, retorna [] y que el caller decida.
      // 4) Último recurso: fallback al endpoint alterno.
      switchMap((res: any) => {
        const arr = normalizePlans(res);
        if (arr) return of(arr);
        // Fallback al otro endpoint publicado
        const fallback = `${environment.apiBase}/workoutPlans?userId=${encodeURIComponent(userId)}`;
        return this.http.get<any>(fallback).pipe(
          map((r: any) => normalizePlans(r) || [])
        );
      }),
      catchError(err => { console.error('getWorkoutPlansByUserId error', err); return of([]); })
    );
  }
}

// Helpers (local scope)
function normalizePlans(res: any): any[] | null {
  try {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res.body === 'string') {
      const j = JSON.parse(res.body);
      if (Array.isArray(j)) return j;
      if (j && Array.isArray(j.items)) return j.items;
      // Respuesta de error conocida { message: 'userId requerido' }
      if (j && j.message) return [];
    }
  } catch (_) { /* ignore */ }
  return null;
}
