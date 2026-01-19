import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ClientBodyMetricsService } from '../../services/client-body-metrics.service';
import { ClientBodyMetric, ClientBodyMetricNumericKey, BodyMetricSeries } from '../../models/body-metrics.model';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { UserApiService, AppUser } from '../../user-api.service';

/**
 * Purpose: host the standalone client body metrics experience.
 * Input/Output: pulls client identity + metrics history and exposes creation + deletion flows.
 * Error handling: surface snackbar messages via the service while also guarding navigation.
 * Standards Check: SRP OK | DRY OK | Tests Pending.
 */
@Component({
  selector: 'app-client-body-metrics',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  templateUrl: './client-body-metrics.component.html',
  styleUrls: ['./client-body-metrics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientBodyMetricsComponent implements OnInit, OnDestroy {
  clientId: string | null = null;
  client: AppUser | null = null;
  metricsHistory: ClientBodyMetric[] = [];
  latestMetricRows: Array<{ label: string; value: string; unit: string }> = [];
  metricSeries: BodyMetricSeries[] = [];
  loadingMetrics = false;
  savingMetric = false;
  deletingMeasurementDate: string | null = null;
  computedBmi: number | null = null;
  readonly metricFieldConfig: Array<{ key: ClientBodyMetricNumericKey; label: string; unit: string }> = [
    { key: 'weightKg', label: 'Peso', unit: 'kg' },
    { key: 'heightCm', label: 'Altura', unit: 'cm' },
    { key: 'bodyFatPercentage', label: 'Grasa corporal', unit: '%' },
    { key: 'muscleMassKg', label: 'Masa muscular', unit: 'kg' },
    { key: 'musclePercentage', label: 'Porcentaje muscular', unit: '%' },
    { key: 'visceralFatLevel', label: 'Grasa visceral', unit: 'nivel' },
    { key: 'bmi', label: 'IMC', unit: 'kg/m²' },
    { key: 'basalMetabolicRate', label: 'Metabolismo basal', unit: 'kcal' },
    { key: 'metabolicAge', label: 'Edad metabólica', unit: 'años' }
  ];
  readonly displayedColumns = [
    'date',
    'weightKg',
    'heightCm',
    'bodyFatPercentage',
    'muscleMassKg',
    'musclePercentage',
    'visceralFatLevel',
    'bmi',
    'basalMetabolicRate',
    'metabolicAge',
    'actions'
  ];
  metricForm!: FormGroup;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private metricsService: ClientBodyMetricsService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private userApi: UserApiService
  ) {
    this.metricForm = this.fb.group({
      weightKg: [null],
      heightCm: [null],
      bodyFatPercentage: [null],
      muscleMassKg: [null],
      musclePercentage: [null],
      visceralFatLevel: [null],
      basalMetabolicRate: [null],
      metabolicAge: [null],
      measurementDate: [new Date()]
    });
  }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id');
    if (!this.clientId) {
      this.router.navigate(['/clients']);
      return;
    }

    this.hydrateClient();
    this.loadMetrics();
    this.metricForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateComputedBmi();
      this.cdr.markForCheck();
    });
    this.updateComputedBmi();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: determine whether the form has at least one numeric value.
   * Input: none. Output: boolean guard.
   * Error handling: none needed (derived state).
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get canSubmitMetric(): boolean {
    return this.metricFieldConfig.some(field => this.hasNumericControlValue(field.key));
  }

  /**
   * Purpose: return the formatted BMI string for the readonly field.
   * Input: none. Output: string representation.
   * Error handling: returns placeholder when no value available.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get computedBmiDisplay(): string {
    return this.computedBmi === null ? 'N/A' : this.computedBmi.toFixed(2);
  }

  /**
   * Purpose: guard creation flow and send payload to service.
   * Input: none. Output: new metric persisted.
   * Error handling: shows snackbar when inputs invalid.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  submitMetric(): void {
    if (this.savingMetric) return;
    if (!this.canSubmitMetric) {
      this.snackBar.open('Completa al menos un valor numérico antes de guardar.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (!this.clientId) {
      this.snackBar.open('No se pudo identificar al cliente.', 'Cerrar', { duration: 3000 });
      return;
    }

    const payload = this.buildMetricPayload();
    if (!payload.measurementDate) {
      this.snackBar.open('Debes definir una fecha válida.', 'Cerrar', { duration: 3000 });
      return;
    }

    this.savingMetric = true;
    this.metricsService.addClientMetric(this.clientId, payload).pipe(
      finalize(() => {
        this.savingMetric = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.snackBar.open('Medición registrada.', 'Cerrar', { duration: 2500 });
        this.metricForm.reset({ measurementDate: new Date() });
        this.updateComputedBmi();
        this.loadMetrics();
      }
    });
  }

  /**
   * Purpose: open confirmation dialog before deleting.
   * Input: metric entry. Output: deletion when confirmed.
   * Error handling: no action when date missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  confirmDeleteMetric(metric: ClientBodyMetric): void {
    if (!metric.measurementDate) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar medición',
        message: `Eliminar la medición registrada el ${new Date(metric.measurementDate).toLocaleString()}? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        icon: 'delete_outline'
      }
    });

    ref.afterClosed().pipe(takeUntil(this.destroy$)).subscribe(confirmed => {
      if (confirmed) {
        this.deleteMetric(metric.measurementDate!);
      }
    });
  }

  private hydrateClient(): void {
    const stateClient = history.state?.client as AppUser | undefined;
    if (stateClient?.id === this.clientId) {
      this.client = stateClient;
      this.cdr.markForCheck();
      return;
    }
    if (!this.clientId) return;
    this.userApi.getUserById(this.clientId).pipe(takeUntil(this.destroy$)).subscribe(client => {
      if (client) {
        this.client = client;
        this.cdr.markForCheck();
      }
    });
  }

  private loadMetrics(): void {
    if (!this.clientId) return;
    this.loadingMetrics = true;
    this.cdr.markForCheck();

    this.metricsService.getClientMetrics(this.clientId).pipe(
      finalize(() => {
        this.loadingMetrics = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: metrics => {
        const sorted = this.sortMetrics(metrics);
        this.metricsHistory = sorted;
        this.updateSummary(sorted);
      },
      error: () => {
        this.metricsHistory = [];
        this.latestMetricRows = [];
        this.metricSeries = [];
      }
    });
  }

  private deleteMetric(measurementDate: string): void {
    if (!this.clientId) return;
    this.deletingMeasurementDate = measurementDate;
    this.cdr.markForCheck();

    this.metricsService.deleteClientMetric(this.clientId, measurementDate).pipe(
      finalize(() => {
        this.deletingMeasurementDate = null;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.snackBar.open('Medición eliminada.', 'Cerrar', { duration: 2500 });
        this.loadMetrics();
      }
    });
  }

  private updateSummary(metrics: ClientBodyMetric[]): void {
    const latest = metrics[0] || null;
    this.latestMetricRows = this.buildMetricDisplayRows(latest);
    this.metricSeries = this.buildMetricSeries(metrics);
    this.cdr.markForCheck();
  }

  private sortMetrics(metrics: ClientBodyMetric[]): ClientBodyMetric[] {
    return metrics
      .slice()
      .sort((a, b) => {
        const timeA = a.measurementDate ? new Date(a.measurementDate).getTime() : 0;
        const timeB = b.measurementDate ? new Date(b.measurementDate).getTime() : 0;
        return timeB - timeA;
      });
  }

  private buildMetricDisplayRows(metric: ClientBodyMetric | null): Array<{ label: string; value: string; unit: string }> {
    if (!metric) return [];
    return this.metricFieldConfig
      .map(field => {
        const value = metric[field.key];
        if (value === null || value === undefined || Number.isNaN(value)) return null;
        return {
          label: field.label,
          value: String(value),
          unit: field.unit
        };
      })
      .filter((row): row is { label: string; value: string; unit: string } => row !== null);
  }

  private buildMetricSeries(metrics: ClientBodyMetric[]): BodyMetricSeries[] {
    return this.metricFieldConfig.map(field => {
      const points = metrics
        .map(metric => {
          const value = metric[field.key];
          if (value === null || value === undefined || Number.isNaN(value)) return null;
          return { date: metric.measurementDate, value };
        })
        .filter((point): point is { date: string; value: number } => point !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        key: field.key,
        label: field.label,
        unit: field.unit,
        points
      };
    });
  }

  private buildMetricPayload(): ClientBodyMetric {
    const payload: Partial<ClientBodyMetric> = {};

    this.metricFieldConfig.forEach(field => {
      const control = this.metricForm.get(field.key);
      if (!control) return;
      const numeric = this.coerceNumber(control.value);
      if (numeric !== null) {
        payload[field.key] = numeric;
      }
    });

    if (this.computedBmi !== null) {
      payload.bmi = Number(this.computedBmi.toFixed(2));
    }

    const dateValue = this.metricForm.get('measurementDate')?.value;
    if (dateValue) {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (!Number.isNaN(date.getTime())) {
        payload.measurementDate = date.toISOString();
      }
    }

    return payload as ClientBodyMetric;
  }

  private hasNumericControlValue(key: ClientBodyMetricNumericKey): boolean {
    const control = this.metricForm.get(key);
    if (!control) return false;
    const numeric = this.coerceNumber(control.value);
    return numeric !== null;
  }

  private coerceNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private updateComputedBmi(): void {
    const weight = this.coerceNumber(this.metricForm.get('weightKg')?.value);
    const heightCm = this.coerceNumber(this.metricForm.get('heightCm')?.value);
    if (weight === null || heightCm === null || heightCm === 0) {
      this.computedBmi = null;
      return;
    }
    const heightMeters = heightCm / 100;
    if (heightMeters === 0) {
      this.computedBmi = null;
      return;
    }
    this.computedBmi = weight / (heightMeters * heightMeters);
  }
}
