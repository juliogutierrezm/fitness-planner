import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser, UserStatus } from '../../user-api.service';
import { AuthService, UserRole } from '../../services/auth.service';
import { isIndependentTenant } from '../../shared/shared-utils';
import { AiPlansService } from '../../services/ai-plans.service';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

/**
 * Purpose: Manage trainers with admin capabilities including creation, editing, activation/deactivation.
 * Shows trainer-specific metrics: assigned clients, AI plan usage, and trial limits.
 */
@Component({
  selector: 'app-trainers-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatDividerModule,
    MatTabsModule,
    RouterModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  templateUrl: './trainers-management.component.html',
  styleUrls: ['./trainers-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainersManagementComponent implements OnInit, OnDestroy {
  trainers: AppUser[] = [];
  allUsers: AppUser[] = [];
  currentUser: any = null;
  form!: FormGroup;
  canCreate = false;
  isAdmin = false;
  isIndependentTenant = false;
  editingId: string | null = null;
  editForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  showCreateForm = false;
  pageTitle = 'Entrenadores';
  trainerClientMap: Record<string, AppUser[]> = {};
  trainerPlanCounts: Record<string, number> = {};
  trainerMetricsLoading = false;
  deletingUserId: string | null = null;
  togglingStatusUserId: string | null = null;
  selectedTabIndex = 0;
  expandedTrainerId: string | null = null;
  trainerAiPlanCounts: Record<string, number> = {};
  aiPlansLoading = false;
  searchTerm = '';
  readonly MAX_AI_PLANS_PER_TRAINER = 20;
  readonly MAX_TRAINERS_TRIAL = 3;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private api: UserApiService,
    private auth: AuthService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private exerciseApi: ExerciseApiService,
    private aiPlansService: AiPlansService
  ) {}

  private formFactory() {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      givenName: ['', Validators.required],
      familyName: ['', Validators.required],
      telephone: [''],
      gender: [''],
      dateOfBirth: ['', Validators.required],
      notes: ['']
    });
  }

  ngOnInit() {
    this.form = this.formFactory();
    this.editForm = this.formFactory();

    this.auth.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.isAdmin = user?.role === UserRole.ADMIN;
        this.isIndependentTenant = isIndependentTenant(user?.companyId);
        this.canCreate = this.api.canCreateUsers();
        this.loadTrainers(user);
      });

    if (!this.auth.getCurrentUser()?.id) {
      this.isLoading = false;
    }
  }

  get activeTrainers(): AppUser[] {
    if (!this.trainers) return [];
    const active = this.trainers.filter(u => (u.status || 'ACTIVE') === 'ACTIVE');
    return this.applySearchFilter(active);
  }

  get inactiveTrainers(): AppUser[] {
    if (!this.trainers) return [];
    const inactive = this.trainers.filter(u => u.status === 'INACTIVE');
    return this.applySearchFilter(inactive);
  }

  private applySearchFilter(trainers: AppUser[]): AppUser[] {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      return trainers;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    return trainers.filter(u => {
      const fullName = `${u.givenName || ''} ${u.familyName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const phone = (u.telephone || '').toLowerCase();
      
      return fullName.includes(term) || email.includes(term) || phone.includes(term);
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.cdr.markForCheck();
  }

  canChangeStatus(): boolean {
    return this.isAdmin;
  }

  openCreateForm(): void {
    if (this.hasReachedTrainerLimit()) {
      this.snack.open(this.getTrainerLimitMessage(), 'Cerrar', { duration: 5000 });
      return;
    }
    
    this.showCreateForm = true;
    this.editingId = null;
    this.cdr.markForCheck();
  }

  private loadTrainers(user: any): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const canManageUsers = user?.role === UserRole.ADMIN || user?.role === UserRole.TRAINER;
    if (!canManageUsers) {
      this.isLoading = false;
      this.trainers = [];
      this.cdr.markForCheck();
      return;
    }

    this.api.getUsersForCurrentTenant().pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (list) => {
        this.allUsers = list || [];
        this.trainers = this.filterTrainers(list);
        this.refreshTrainerMetrics();
      },
      error: () => {
        this.trainers = [];
        this.allUsers = [];
        this.snack.open('No se pudieron cargar los entrenadores.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  private filterTrainers(users: AppUser[] | null | undefined): AppUser[] {
    if (!users || !Array.isArray(users)) return [];
    return users.filter(u => u.role === 'trainer');
  }

  private refreshTrainerMetrics(): void {
    this.buildTrainerClientMap();
    this.loadTrainerPlanCounts();
    this.loadAllTrainerAiPlanCounts();
  }

  private buildTrainerClientMap(): void {
    const map: Record<string, AppUser[]> = {};
    if (!Array.isArray(this.allUsers)) {
      this.trainerClientMap = map;
      return;
    }

    this.allUsers
      .filter(user => user.role === 'client' && user.trainerId)
      .forEach(client => {
        const trainerId = client.trainerId as string;
        if (!map[trainerId]) {
          map[trainerId] = [];
        }
        map[trainerId].push(client);
      });

    this.trainerClientMap = map;
  }

  private loadTrainerPlanCounts(): void {
    this.trainerMetricsLoading = true;
    this.exerciseApi.getPlansForCurrentTenant().pipe(
      finalize(() => {
        this.trainerMetricsLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (plans) => {
        const counts: Record<string, number> = {};
        (plans || [])
          .filter(plan => plan?.isTemplate !== true)
          .forEach(plan => {
            const trainerId = plan?.trainerId;
            if (!trainerId) return;
            counts[trainerId] = (counts[trainerId] || 0) + 1;
          });
        this.trainerPlanCounts = counts;
      },
      error: () => {
        this.trainerPlanCounts = {};
        this.snack.open('No se pudieron cargar los planes de entrenadores.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  getTrainerClientCount(trainer: AppUser | null | undefined): number {
    const trainerId = trainer?.id;
    if (!trainerId) return 0;
    return this.trainerClientMap[trainerId]?.length || 0;
  }

  getTrainerPlanCount(trainer: AppUser | null | undefined): number {
    const trainerId = trainer?.id;
    if (!trainerId) return 0;
    return this.trainerPlanCounts[trainerId] || 0;
  }

  toggleTrainerExpansion(trainer: AppUser): void {
    if (!trainer?.id) return;
    
    if (this.expandedTrainerId === trainer.id) {
      this.expandedTrainerId = null;
    } else {
      this.expandedTrainerId = trainer.id;
    }
    this.cdr.markForCheck();
  }

  isTrainerExpanded(trainer: AppUser): boolean {
    return this.expandedTrainerId === trainer.id;
  }

  private loadAllTrainerAiPlanCounts(): void {
    if (!this.trainers || this.trainers.length === 0) return;
    
    this.aiPlansLoading = true;
    this.cdr.markForCheck();
    
    // Cargar conteo de planes IA para todos los entrenadores
    this.trainers.forEach(trainer => {
      if (trainer.id) {
        this.loadTrainerAiPlanCount(trainer.id);
      }
    });
  }

  private loadTrainerAiPlanCount(trainerId: string): void {
    if (!trainerId) return;
    
    this.aiPlansLoading = true;
    this.cdr.markForCheck();
    
    this.aiPlansService.getByTrainer(trainerId).pipe(
      finalize(() => {
        this.aiPlansLoading = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (response) => {
        this.trainerAiPlanCounts[trainerId] = response?.totalPlans || 0;
      },
      error: () => {
        this.trainerAiPlanCounts[trainerId] = 0;
        this.snack.open('No se pudo cargar el conteo de planes IA.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  getTrainerAiPlanCount(trainer: AppUser | null | undefined): number {
    const trainerId = trainer?.id;
    if (!trainerId) return 0;
    return this.trainerAiPlanCounts[trainerId] || 0;
  }

  hasReachedAiPlanLimit(trainer: AppUser | null | undefined): boolean {
    const count = this.getTrainerAiPlanCount(trainer);
    return count >= this.MAX_AI_PLANS_PER_TRAINER;
  }

  getTrainerClients(trainer: AppUser | null | undefined): AppUser[] {
    const trainerId = trainer?.id;
    if (!trainerId) return [];
    return this.trainerClientMap[trainerId] || [];
  }

  hasReachedTrainerLimit(): boolean {
    return this.activeTrainers.length >= this.MAX_TRAINERS_TRIAL;
  }

  getTrainerLimitMessage(): string {
    return `Has alcanzado el límite de ${this.MAX_TRAINERS_TRIAL} entrenadores permitidos en la versión de prueba.`;
  }

  getAiPlanLimitMessage(): string {
    return `Este entrenador ha alcanzado el límite de ${this.MAX_AI_PLANS_PER_TRAINER} planes de entrenamiento con IA permitidos en la versión de prueba.`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private reloadTrainers(): void {
    if (!this.currentUser) return;
    this.loadTrainers(this.currentUser);
  }

  submit() {
    if (this.form.invalid || this.isSaving) return;
    const formValue = this.form.value;
    const payload: AppUser = {
      email: formValue.email!,
      givenName: formValue.givenName || '',
      familyName: formValue.familyName || '',
      telephone: formValue.telephone || null,
      gender: formValue.gender || null,
      role: 'trainer',
      dateOfBirth: formValue.dateOfBirth || '',
      notes: formValue.notes || null
    };
    this.isSaving = true;
    this.api.createUser(payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      })
    ).subscribe(res => {
      if (res) {
        this.snack.open('Entrenador creado', 'Cerrar', { duration: 2000 });
        this.form.reset({ email: '', givenName: '', familyName: '', telephone: '', gender: '', dateOfBirth: '', notes: '' });
        this.showCreateForm = false;
        this.reloadTrainers();
      } else {
        this.snack.open('No se pudo crear el entrenador', 'Cerrar', { duration: 2500 });
      }
    });
  }

  remove(u: AppUser): void {
    if (!u?.id || this.deletingUserId) return;

    const userStatus = u.status || 'ACTIVE';
    if (userStatus !== 'INACTIVE') {
      this.snack.open('Solo se pueden eliminar entrenadores inactivos. Desactiva primero al entrenador.', 'Cerrar', { duration: 4000 });
      return;
    }

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este entrenador';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar entrenador permanentemente',
        message: `¿Eliminar ${label} permanentemente? Esta acción no se puede deshacer y se perderán todos los datos asociados.`,
        confirmLabel: 'Eliminar permanentemente',
        cancelLabel: 'Cancelar',
        icon: 'delete_forever'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingUserId = u.id!;
      this.cdr.markForCheck();
      this.api.deleteUser(u.id!).pipe(
        finalize(() => {
          this.deletingUserId = null;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: () => {
          this.trainers = this.trainers.filter(user => user.id !== u.id);
          this.allUsers = this.allUsers.filter(user => user.id !== u.id);
          this.snack.open('Entrenador eliminado permanentemente', 'Cerrar', { duration: 2500 });
        },
        error: () => {
          this.snack.open('No se pudo eliminar el entrenador', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }

  deactivateUser(u: AppUser): void {
    if (!u?.id || this.togglingStatusUserId || !this.canChangeStatus()) return;

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este entrenador';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Desactivar entrenador',
        message: `¿Desactivar a ${label}? El entrenador no podrá acceder al sistema pero sus datos se conservarán.`,
        confirmLabel: 'Desactivar',
        cancelLabel: 'Cancelar',
        icon: 'block'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.togglingStatusUserId = u.id!;
      this.cdr.markForCheck();
      this.api.deactivateUser(u.id!).pipe(
        finalize(() => {
          this.togglingStatusUserId = null;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: () => {
          this.trainers = this.trainers.map(user => user.id === u.id ? { ...user, status: 'INACTIVE' } : user);
          this.allUsers = this.allUsers.map(user => user.id === u.id ? { ...user, status: 'INACTIVE' } : user);
          this.snack.open('Entrenador desactivado', 'Cerrar', { duration: 2000 });
          this.selectedTabIndex = 1;
        },
        error: () => {
          this.snack.open('No se pudo desactivar el entrenador', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }

  activateUser(u: AppUser): void {
    if (!u?.id || this.togglingStatusUserId || !this.canChangeStatus()) return;

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este entrenador';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Activar entrenador',
        message: `¿Activar a ${label}? El entrenador podrá volver a acceder al sistema.`,
        confirmLabel: 'Activar',
        cancelLabel: 'Cancelar',
        icon: 'check_circle'
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.togglingStatusUserId = u.id!;
      this.cdr.markForCheck();
      this.api.activateUser(u.id!).pipe(
        finalize(() => {
          this.togglingStatusUserId = null;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: () => {
          this.trainers = this.trainers.map(user => user.id === u.id ? { ...user, status: 'ACTIVE' } : user);
          this.allUsers = this.allUsers.map(user => user.id === u.id ? { ...user, status: 'ACTIVE' } : user);
          this.snack.open('Entrenador activado', 'Cerrar', { duration: 2000 });
          this.selectedTabIndex = 0;
        },
        error: () => {
          this.snack.open('No se pudo activar el entrenador', 'Cerrar', { duration: 3000 });
        }
      });
    });
  }

  startEdit(u: AppUser) {
    this.editingId = u.id!;
    this.editForm.patchValue({
      email: u.email,
      givenName: u.givenName || '',
      familyName: u.familyName || '',
      telephone: u.telephone || '',
      gender: u.gender || '',
      dateOfBirth: u.dateOfBirth || '',
      notes: u.notes || ''
    });
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm.reset();
    this.cdr.markForCheck();
  }

  saveEdit(u: AppUser) {
    if (this.editForm.invalid || this.isSaving || !u?.id) return;
    const formValue = this.editForm.value;
    const payload: AppUser = {
      ...u,
      givenName: formValue.givenName || '',
      familyName: formValue.familyName || '',
      telephone: formValue.telephone || null,
      gender: formValue.gender || null,
      dateOfBirth: formValue.dateOfBirth || '',
      notes: formValue.notes || null
    };
    this.isSaving = true;
    this.cdr.markForCheck();
    this.api.updateUser(payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (updated) => {
        if (updated) {
          this.trainers = this.trainers.map(user => user.id === u.id ? { ...user, ...payload } : user);
          this.allUsers = this.allUsers.map(user => user.id === u.id ? { ...user, ...payload } : user);
          this.snack.open('Entrenador actualizado', 'Cerrar', { duration: 2000 });
          this.editingId = null;
          this.editForm.reset();
        } else {
          this.snack.open('No se pudo actualizar el entrenador', 'Cerrar', { duration: 2500 });
        }
      },
      error: () => {
        this.snack.open('Error al actualizar el entrenador', 'Cerrar', { duration: 3000 });
      }
    });
  }
}
