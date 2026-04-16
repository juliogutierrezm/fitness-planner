import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ClientBodyMeasurementFile } from '../models/body-metrics.model';

@Injectable({ providedIn: 'root' })
export class ClientBodyMeasurementFileService {
  private readonly baseUrl = `${environment.apiBase}/clients/metrics`;

  constructor(private http: HttpClient, private snackBar: MatSnackBar) {}

  getUploadUrl(clientId: string, filename: string, contentType: string): Observable<{ uploadUrl: string; fileKey: string }> {
    return this.http.post<any>(`${this.baseUrl}/upload-url`, { clientId, filename, contentType }).pipe(
      map(res => ({ uploadUrl: res.uploadUrl, fileKey: res.fileKey })),
      catchError(this.handleError('getUploadUrl', 'No se pudo obtener la URL de subida.'))
    );
  }

  async uploadFileToS3(uploadUrl: string, file: File): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('S3 upload error:', errorText);
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  createFileRecord(payload: { clientId: string; fileKey: string; fileName: string; contentType: string }): Observable<ClientBodyMeasurementFile> {
    return this.http.post<ClientBodyMeasurementFile>(`${this.baseUrl}/file`, payload).pipe(
      catchError(this.handleError('createFileRecord', 'No se pudo registrar el archivo.'))
    );
  }

  getFilesByClient(clientId: string): Observable<ClientBodyMeasurementFile[]> {
    if (!clientId?.trim()) {
      return of([]);
    }
    return this.http.get<any>(`${this.baseUrl}/file`, {
      params: { clientId }
    }).pipe(
      map(res => normalizeFilesResponse(res)),
      catchError(this.handleError('getFilesByClient', 'No se pudieron cargar los archivos.'))
    );
  }

  deleteFile(file: ClientBodyMeasurementFile): Observable<void> {
    return this.http.request<void>('DELETE', `${this.baseUrl}/file`, {
      body: {
        clientId: file.clientId,
        createdAt: file.createdAt,
        fileKey: file.fileKey
      }
    }).pipe(
      catchError(this.handleError('deleteFile', 'No se pudo eliminar el archivo.'))
    );
  }

  getDownloadUrl(fileKey: string): Observable<{ downloadUrl: string }> {
    return this.http.post<{ downloadUrl: string }>(`${this.baseUrl}/download-url`, { fileKey }).pipe(
      catchError(this.handleError('getDownloadUrl', 'No se pudo obtener la URL de descarga.'))
    );
  }

  private handleError(operation: string, message: string) {
    return (error: any) => {
      console.error(`[ClientBodyMeasurementFile] ${operation} failed`, { error });
      this.snackBar.open(message, 'Cerrar', { duration: 3500 });
      return throwError(() => error);
    };
  }
}

function normalizeFilesResponse(res: any): ClientBodyMeasurementFile[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && typeof res.body === 'string') {
    try {
      const parsed = JSON.parse(res.body);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch (_err) {
      return [];
    }
  }
  if (res && Array.isArray(res.body)) return res.body;
  return [];
}
