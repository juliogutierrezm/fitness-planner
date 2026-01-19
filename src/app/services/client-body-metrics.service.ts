import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ClientBodyMetric } from '../models/body-metrics.model';

/**
 * Purpose: API gateway for client body metrics operations.
 * Input/Output: translates HTTP responses into strongly typed DTOs.
 * Error handling: logs and surfaces friendly snackbar messages before propagating errors.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Injectable({ providedIn: 'root' })
export class ClientBodyMetricsService {
  private readonly metricsUrl = `${environment.apiBase}/clients/metrics`;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  /**
   * Purpose: fetch all metrics stored for a client.
   * Input: clientId string. Output: Observable<ClientBodyMetric[]>.
   * Error handling: returns empty list for missing id; shows snackbar on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getClientMetrics(clientId: string): Observable<ClientBodyMetric[]> {
    if (!clientId?.trim()) {
      console.warn('[ClientBodyMetrics] Missing clientId for fetch');
      return of([]);
    }

    const url = `${this.metricsUrl}/${encodeURIComponent(clientId)}`;
    return this.http.get<any>(url).pipe(
      map(res => normalizeMetricsResponse(res)),
      catchError(this.handleError('fetch', 'No se pudieron cargar las mediciones.'))
    );
  }

  /**
   * Purpose: add a historical metric entry for the provided client.
   * Input: clientId and ClientBodyMetric payload. Output: Observable<ClientBodyMetric | null>.
   * Error handling: warns when inputs missing; shows snackbar on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  addClientMetric(clientId: string, payload: ClientBodyMetric): Observable<ClientBodyMetric | null> {
    if (!clientId?.trim()) {
      console.warn('[ClientBodyMetrics] Missing clientId for add');
      return of(null);
    }
    if (!payload || !payload.measurementDate) {
      console.warn('[ClientBodyMetrics] Missing payload or measurementDate for add', { payload });
      return of(null);
    }

    const url = `${this.metricsUrl}/${encodeURIComponent(clientId)}`;
    return this.http.post<ClientBodyMetric>(url, payload).pipe(
      catchError(this.handleError('add', 'No se pudo guardar la medición.'))
    );
  }

  /**
   * Purpose: delete a metric entry identified by measurementDate.
   * Input: clientId and ISO measurementDate. Output: Observable<void>.
   * Error handling: warns on missing inputs; shows snackbar on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  deleteClientMetric(clientId: string, measurementDate: string): Observable<void> {
    if (!clientId?.trim()) {
      console.warn('[ClientBodyMetrics] Missing clientId for delete');
      return of();
    }
    if (!measurementDate) {
      console.warn('[ClientBodyMetrics] Missing measurementDate for delete', { clientId });
      return of();
    }

    const url = `${this.metricsUrl}/${encodeURIComponent(clientId)}?measurementDate=${encodeURIComponent(measurementDate)}`;
    return this.http.delete<void>(url).pipe(
      catchError(this.handleError('delete', 'No se pudo eliminar la medición.'))
    );
  }

  private handleError(operation: string, message: string) {
    return (error: any) => {
      console.error(`[ClientBodyMetrics] ${operation} failed`, { error });
      this.snackBar.open(message, 'Cerrar', { duration: 3500 });
      return throwError(() => error);
    };
  }
}

function normalizeMetricsResponse(res: any): ClientBodyMetric[] {
  if (Array.isArray(res)) return res as ClientBodyMetric[];
  if (res && Array.isArray(res.items)) return res.items as ClientBodyMetric[];
  if (res && typeof res.body === 'string') {
    try {
      const parsed = JSON.parse(res.body);
      if (Array.isArray(parsed)) return parsed as ClientBodyMetric[];
      if (parsed && Array.isArray(parsed.items)) return parsed.items as ClientBodyMetric[];
    } catch (_err) {
      return [];
    }
  }
  if (res && Array.isArray(res.body)) return res.body as ClientBodyMetric[];
  return [];
}
