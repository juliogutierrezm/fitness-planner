import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, Input, TemplateRef, ViewChild } from '@angular/core';
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
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser } from '../../user-api.service';
import { AuthService, UserRole } from '../../services/auth.service';

import { MatTooltipModule } from '@angular/material/tooltip';



@Component({
  selector: 'app-users',
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
    RouterModule,
    MatTooltipModule
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
  @Input() contextRole: 'client' | 'trainer' = 'client';
  users: AppUser[] = [];
  allUsers: AppUser[] = [];
  currentUser: any = null;
  form!: FormGroup;
  canCreate = false;
  isAdmin = false;
  editingId: string | null = null;
  editForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  showCreateForm = false;
  pageTitle = '';
  isAssigningTrainer = false;
  selectedClientForAssignment: AppUser | null = null;
  @ViewChild('trainerSelectDialog') trainerSelectDialog?: TemplateRef<any>;
  trainerClientMap: Record<string, AppUser[]> = {};
  trainerPlanCounts: Record<string, number> = {};
  trainerMetricsLoading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private api: UserApiService,
    private auth: AuthService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private exerciseApi: ExerciseApiService
  ) {}

  private formFactory() {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      givenName: ['', Validators.required],
      familyName: ['', Validators.required],
      telephone: [''],
      gender: [''],
      dateOfBirth: ['', Validators.required],
      noInjuries: [true],
      injuries: [''],
      notes: ['']
    });
  }

  ngOnInit() {
    this.pageTitle = this.getPageTitle();

    this.form = this.formFactory();
    this.editForm = this.formFactory();

    // Set up injuries field control based on noInjuries checkbox
    this.setupInjuriesControl(this.form);
    this.setupInjuriesControl(this.editForm);

    this.auth.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.isAdmin = user?.role === UserRole.ADMIN;
        this.canCreate = this.api.canCreateUsers();
        this.loadUsersForCurrentUser(user);
      });

    if (!this.auth.getCurrentUser()?.id) {
      this.isLoading = false;
    }
  }

  /**
   * Purpose: expose context flag for client-only UI.
   * Input: none. Output: boolean indicator.
   * Error handling: not applicable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get isClientView(): boolean {
    return this.contextRole === 'client';
  }

  /**
   * Purpose: expose context flag for trainer-only UI.
   * Input: none. Output: boolean indicator.
   * Error handling: not applicable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get isTrainerView(): boolean {
    return this.contextRole === 'trainer';
  }

  private getPageTitle(): string {
    if (this.contextRole === 'trainer') return 'Entrenadores';
    return 'Clientes';
  }

  /**
   * Purpose: load and filter users for the current tenant and role context.
   * Input: current auth user. Output: updates list state.
   * Error handling: shows snackbar and clears lists on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private loadUsersForCurrentUser(user: any): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const canManageUsers = user?.role === UserRole.ADMIN || user?.role === UserRole.TRAINER;
    if (!canManageUsers) {
      this.users = [];
      this.allUsers = [];
      this.trainerClientMap = {};
      this.trainerPlanCounts = {};
      this.isLoading = false;
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
        this.users = this.filterUsers(this.allUsers);
        this.refreshTrainerMetrics();
      },
      error: () => {
        this.users = [];
        this.allUsers = [];
        this.trainerClientMap = {};
        this.trainerPlanCounts = {};
        this.snack.open('No se pudieron cargar los usuarios.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Purpose: filter users by role context for the view.
   * Input: full user list. Output: filtered list.
   * Error handling: returns empty list for missing input.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private filterUsers(users: AppUser[] | null | undefined): AppUser[] {
    if (!users || !Array.isArray(users)) return [];
    return users.filter(u => u.role === this.contextRole);
  }

  /**
   * Purpose: refresh trainer-only metrics after user data loads.
   * Input: none. Output: updates trainer metrics caches.
   * Error handling: resets metrics when not in trainer context.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private refreshTrainerMetrics(): void {
    if (!this.isTrainerView) {
      this.trainerClientMap = {};
      this.trainerPlanCounts = {};
      return;
    }
    this.buildTrainerClientMap();
    this.loadTrainerPlanCounts();
  }

  /**
   * Purpose: rebuild a map of clients assigned per trainer.
   * Input: none. Output: updates trainerClientMap cache.
   * Error handling: falls back to empty map when no users exist.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
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

  /**
   * Purpose: load and cache plan counts created by each trainer.
   * Input: none. Output: updates trainerPlanCounts.
   * Error handling: shows snackbar and clears counts on failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
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

  /**
   * Purpose: return the assigned client count for a trainer.
   * Input: trainer user. Output: count number.
   * Error handling: returns 0 when trainer id missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTrainerClientCount(trainer: AppUser | null | undefined): number {
    const trainerId = trainer?.id;
    if (!trainerId) return 0;
    return this.trainerClientMap[trainerId]?.length || 0;
  }

  /**
   * Purpose: summarize assigned clients for display.
   * Input: trainer user. Output: summary string.
   * Error handling: returns fallback labels when data missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTrainerClientSummary(trainer: AppUser | null | undefined): string {
    const trainerId = trainer?.id;
    if (!trainerId) return 'Sin clientes';
    const clients = this.trainerClientMap[trainerId] || [];
    if (clients.length === 0) return 'Sin clientes';

    const names = clients.map(client => {
      const fullName = `${client.givenName || ''} ${client.familyName || ''}`.trim();
      return fullName || client.email;
    }).filter(Boolean);

    const limit = 3;
    const shown = names.slice(0, limit);
    const remaining = names.length - shown.length;
    if (remaining > 0) {
      return `${shown.join(', ')} y ${remaining} mas`;
    }
    return shown.join(', ');
  }

  /**
   * Purpose: return the plan count created by a trainer.
   * Input: trainer user. Output: count number.
   * Error handling: returns 0 when trainer id missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  getTrainerPlanCount(trainer: AppUser | null | undefined): number {
    const trainerId = trainer?.id;
    if (!trainerId) return 0;
    return this.trainerPlanCounts[trainerId] || 0;
  }

  private setupInjuriesControl(form: FormGroup) {
    const noInjuriesControl = form.get('noInjuries');
    const injuriesControl = form.get('injuries');

    if (noInjuriesControl && injuriesControl) {
      noInjuriesControl.valueChanges.subscribe(noInjuries => {
        if (noInjuries) {
          injuriesControl.disable({ emitEvent: false });
        } else {
          injuriesControl.enable({ emitEvent: false });
        }
      });

      // Set initial state
      if (noInjuriesControl.value) {
        injuriesControl.disable({ emitEvent: false });
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Purpose: reload users using the cached current user context.
   * Input: none. Output: refreshes list state.
   * Error handling: no-op when current user is missing.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private reloadUsers(): void {
    if (!this.currentUser) return;
    this.loadUsersForCurrentUser(this.currentUser);
  }

  submit() {
    if (this.form.invalid || this.isSaving) return;
    const formValue = this.form.value;
    const role = this.contextRole;
    const payload: AppUser = {
      email: formValue.email!,
      givenName: formValue.givenName || '',
      familyName: formValue.familyName || '',
      telephone: formValue.telephone || null,
      gender: formValue.gender || null,
      role: role,
      dateOfBirth: formValue.dateOfBirth || '',
      noInjuries: formValue.noInjuries,
      injuries: formValue.noInjuries ? null : (formValue.injuries?.trim() || null),
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
        this.snack.open('Usuario creado', 'Cerrar', { duration: 2000 });
        this.form.reset({ email: '', givenName: '', familyName: '', telephone: '', gender: '', dateOfBirth: '', noInjuries: true, injuries: '', notes: '' });
        this.showCreateForm = false;
        this.reloadUsers();
      } else {
        this.snack.open('No se pudo crear', 'Cerrar', { duration: 2500 });
      }
    });
  }

  remove(u: AppUser) {
    if (!u.id) return;
    this.api.deleteUser(u.id).subscribe(ok => {
      if (ok !== null) {
        this.users = this.users.filter(x => x.id !== u.id);
        this.allUsers = this.allUsers.filter(x => x.id !== u.id);
        if (this.isTrainerView) {
          this.refreshTrainerMetrics();
        }
        this.cdr.markForCheck();
        this.snack.open('Usuario eliminado', 'Cerrar', { duration: 1800 });
      } else {
        this.snack.open('No se pudo eliminar', 'Cerrar', { duration: 2500 });
      }
    });
  }

  startEdit(u: AppUser) {
    if (!u) return;
    this.editingId = u.id || null;
    this.editForm.reset({
      email: u.email || '',
      givenName: u.givenName || '',
      familyName: u.familyName || '',
      telephone: u.telephone || '',
      gender: u.gender || '',
      dateOfBirth: u.dateOfBirth || '',
      noInjuries: u.noInjuries ?? false, // Default to false if not set
      injuries: u.injuries || '',
      notes: u.notes || ''
    });
    // Disable email field to prevent editing
    this.editForm.get('email')?.disable({ emitEvent: false });
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveEdit(u: AppUser) {
    if (!this.editingId || !u?.id || this.editForm.invalid || this.isSaving) return;
    const editFormValue = this.editForm.value;
    const payload: AppUser = {
      id: u.id,
      email: u.email!, // Keep original email, don't allow changes
      givenName: editFormValue.givenName || '',
      familyName: editFormValue.familyName || '',
      telephone: editFormValue.telephone || '',
      gender: editFormValue.gender || u.gender,
      role: u.role,
      dateOfBirth: editFormValue.dateOfBirth || u.dateOfBirth,
      noInjuries: editFormValue.noInjuries,
      injuries: editFormValue.noInjuries ? null : (editFormValue.injuries?.trim() || null),
      notes: editFormValue.notes || u.notes
    };
    this.isSaving = true;
    this.api.updateUser(payload).pipe(
      finalize(() => {
        this.isSaving = false;
        this.cdr.markForCheck();
      })
    ).subscribe(res => {
      if (res !== null) {
        this.users = this.users.map(x => x.id === u.id ? { ...x, ...payload } : x);
        this.allUsers = this.allUsers.map(x => x.id === u.id ? { ...x, ...payload } : x);
        this.editingId = null;
        this.cdr.markForCheck();
        this.snack.open('Usuario actualizado', 'Cerrar', { duration: 1800 });
      } else {
        this.snack.open('No se pudo actualizar', 'Cerrar', { duration: 2500 });
      }
    });
  }

  getTrainerName(client: AppUser): string {
    if (!client.trainerId) return 'Sin asignar';
    const trainer = this.allUsers.find(u => u.id === client.trainerId);
    return trainer ? `${trainer.givenName || ''} ${trainer.familyName || ''}`.trim() || trainer.email : 'Entrenador desconocido';
  }

  getAvailableTrainers(): AppUser[] {
    const currentUser = this.auth.getCurrentUser();
    const companyId = currentUser?.companyId || 'INDEPENDENT';
    return this.allUsers.filter(u => u.role === 'trainer' && (u.companyId === companyId || u.companyId === 'INDEPENDENT'));
  }

  assignTrainer(client: AppUser) {
    if (!this.isAdmin || !this.isClientView) return;
    this.selectedClientForAssignment = client;
    if (!this.trainerSelectDialog) {
      this.snack.open('Error: No se pudo abrir el selector de entrenadores.', 'Cerrar', { duration: 3000 });
      return;
    }
    if (this.getAvailableTrainers().length === 0) {
      this.snack.open('No hay entrenadores disponibles.', 'Cerrar', { duration: 3000 });
      return;
    }
    this.dialog.open(this.trainerSelectDialog, {
      width: '520px',
      maxWidth: '92vw'
    });
  }

  confirmAssignTrainer(trainer: AppUser) {
    if (!this.selectedClientForAssignment?.id || !trainer?.id) return;
    this.isAssigningTrainer = true;
    this.cdr.markForCheck();
    this.api.assignTrainer(this.selectedClientForAssignment.id, trainer.id).pipe(
      finalize(() => {
        this.isAssigningTrainer = false;
        this.selectedClientForAssignment = null;
        this.dialog.closeAll();
        this.cdr.markForCheck();
      })
    ).subscribe({
      next: (res) => {
        if (res !== null) {
          // Update the client in the list
          this.users = this.users.map(u => u.id === this.selectedClientForAssignment!.id ? { ...u, trainerId: trainer.id } : u);
          this.allUsers = this.allUsers.map(u => u.id === this.selectedClientForAssignment!.id ? { ...u, trainerId: trainer.id } : u);
          this.snack.open('Entrenador asignado exitosamente', 'Cerrar', { duration: 2000 });
        } else {
          this.snack.open('No se pudo asignar el entrenador', 'Cerrar', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Assign trainer error', err);
        this.snack.open('Error al asignar entrenador', 'Cerrar', { duration: 3000 });
      }
    });
  }
}
