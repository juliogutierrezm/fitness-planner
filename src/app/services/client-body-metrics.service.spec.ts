import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../environments/environment';
import { ClientBodyMetricsService } from './client-body-metrics.service';

describe('ClientBodyMetricsService', () => {
  let service: ClientBodyMetricsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatSnackBarModule]
    });

    service = TestBed.inject(ClientBodyMetricsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch client metrics array', () => {
    const clientId = 'client-123';
    const mockResponse = [{ measurementDate: '2024-01-01T00:00:00.000Z', weightKg: 75 }];

    service.getClientMetrics(clientId).subscribe(metrics => {
      expect(metrics.length).toBe(1);
      expect(metrics[0].weightKg).toBe(75);
    });

    const req = httpMock.expectOne(`${environment.apiBase}/clients/metrics/${encodeURIComponent(clientId)}`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should post a new metric entry', () => {
    const clientId = 'client-abc';
    const payload = { measurementDate: '2025-01-01T00:00:00.000Z', weightKg: 70 };

    service.addClientMetric(clientId, payload).subscribe(result => {
      expect(result?.weightKg).toBe(70);
    });

    const req = httpMock.expectOne(`${environment.apiBase}/clients/metrics/${encodeURIComponent(clientId)}`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(payload);
  });

  it('should delete a metric by measurementDate', () => {
    const clientId = 'client-delete';
    const measurementDate = '2025-06-01T08:30:00.000Z';

    service.deleteClientMetric(clientId, measurementDate).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/clients/metrics/${encodeURIComponent(clientId)}?measurementDate=${encodeURIComponent(measurementDate)}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
