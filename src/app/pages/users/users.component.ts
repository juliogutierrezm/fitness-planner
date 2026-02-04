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
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { ExerciseApiService } from '../../exercise-api.service';
import { UserApiService, AppUser, UserStatus } from '../../user-api.service';
import { AuthService, UserRole } from '../../services/auth.service';
import { isIndependentTenant } from '../../shared/shared-utils';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';



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
    MatDividerModule,
    MatTabsModule,
    RouterModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
  users: AppUser[] = [];
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
  pageTitle = 'Clientes';
  isAssigningTrainer = false;
  selectedClientForAssignment: AppUser | null = null;
  @ViewChild('trainerSelectDialog') trainerSelectDialog?: TemplateRef<any>;
  deletingUserId: string | null = null;
  togglingStatusUserId: string | null = null;
  selectedTabIndex = 0;
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
        this.isIndependentTenant = isIndependentTenant(user?.companyId);
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
    return true; // Always client view now
  }

  /**
   * Purpose: filter users to only active ones.
   * Input: none. Output: filtered AppUser array.
   * Error handling: returns empty array if users is null/undefined.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get activeUsers(): AppUser[] {
    if (!this.users) return [];
    return this.users.filter(u => (u.status || 'ACTIVE') === 'ACTIVE');
  }

  /**
   * Purpose: filter users to only inactive ones.
   * Input: none. Output: filtered AppUser array.
   * Error handling: returns empty array if users is null/undefined.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  get inactiveUsers(): AppUser[] {
    if (!this.users) return [];
    return this.users.filter(u => u.status === 'INACTIVE');
  }

  /**
   * Purpose: check if current user can change user status (Admin only).
   * Input: none. Output: boolean.
   * Error handling: returns false if not admin.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  canChangeStatus(): boolean {
    return this.isAdmin;
  }

  /**
   * Purpose: open the create form and close edit views.
   * Input: none. Output: toggles view state.
   * Error handling: not applicable.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  openCreateForm(): void {
    this.showCreateForm = true;
    this.editingId = null;
    this.cdr.markForCheck();
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
      },
      error: () => {
        this.users = [];
        this.allUsers = [];
        this.snack.open('No se pudieron cargar los usuarios.', 'Cerrar', { duration: 3000 });
      }
    });
  }

  /**
   * Purpose: filter users to show only clients.
   * Input: full user list. Output: filtered list.
   * Error handling: returns empty list for missing input.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  private filterUsers(users: AppUser[] | null | undefined): AppUser[] {
    if (!users || !Array.isArray(users)) return [];
    return users.filter(u => u.role === 'client');
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
    const payload: AppUser = {
      email: formValue.email!,
      givenName: formValue.givenName || '',
      familyName: formValue.familyName || '',
      telephone: formValue.telephone || null,
      gender: formValue.gender || null,
      role: 'client',
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

  /**
   * Purpose: confirm and delete a user with UI feedback.
   * Input: user entity. Output: removes user from local lists when successful.
   * Error handling: shows snackbar and logs errors if deletion fails.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  remove(u: AppUser): void {
    if (!u?.id || this.deletingUserId) return;

    // Block deletion if user is not INACTIVE
    const userStatus = u.status || 'ACTIVE';
    if (userStatus !== 'INACTIVE') {
      this.snack.open('Solo se pueden eliminar usuarios inactivos.', 'Cerrar', { duration: 3000 });
      return;
    }

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este usuario';
    const roleLabel = u.role === 'trainer' ? 'entrenador' : 'cliente';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Eliminar ${roleLabel} permanentemente`,
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
      this.api.deleteUser(u.id!, u.status).pipe(
        finalize(() => {
          this.deletingUserId = null;
          this.cdr.markForCheck();
        })
      ).subscribe({
        next: (ok) => {
          if (ok !== null) {
            this.users = this.users.filter(x => x.id !== u.id);
            this.allUsers = this.allUsers.filter(x => x.id !== u.id);
            this.snack.open('Usuario eliminado permanentemente', 'Cerrar', { duration: 1800 });
          } else {
            this.snack.open('No se pudo eliminar', 'Cerrar', { duration: 2500 });
          }
        },
        error: (error) => {
          console.error('deleteUser failed', { userId: u.id, error });
          this.snack.open('No se pudo eliminar', 'Cerrar', { duration: 2500 });
        }
      });
    });
  }

  /**
   * Purpose: deactivate a user with confirmation dialog.
   * Input: user entity. Output: updates user status to INACTIVE.
   * Error handling: shows snackbar on success/failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  deactivateUser(u: AppUser): void {
    if (!u?.id || this.togglingStatusUserId || !this.canChangeStatus()) return;

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este usuario';
    const roleLabel = u.role === 'trainer' ? 'entrenador' : 'cliente';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Desactivar ${roleLabel}`,
        message: `¿Desactivar a ${label}? El usuario no podrá acceder al sistema pero sus datos se conservarán.`,
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
        next: (res) => {
          if (res !== null) {
            // Update local user status
            this.users = this.users.map(x => x.id === u.id ? { ...x, status: 'INACTIVE' as UserStatus } : x);
            this.allUsers = this.allUsers.map(x => x.id === u.id ? { ...x, status: 'INACTIVE' as UserStatus } : x);
            this.snack.open('Usuario desactivado', 'Cerrar', { duration: 1800 });
          } else {
            this.snack.open('No se pudo desactivar', 'Cerrar', { duration: 2500 });
          }
        },
        error: (error) => {
          console.error('deactivateUser failed', { userId: u.id, error });
          this.snack.open('No se pudo desactivar', 'Cerrar', { duration: 2500 });
        }
      });
    });
  }

  /**
   * Purpose: activate a user with confirmation dialog.
   * Input: user entity. Output: updates user status to ACTIVE.
   * Error handling: shows snackbar on success/failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  activateUser(u: AppUser): void {
    if (!u?.id || this.togglingStatusUserId || !this.canChangeStatus()) return;

    const fullName = `${u.givenName || ''} ${u.familyName || ''}`.trim();
    const label = fullName || u.email || 'este usuario';
    const roleLabel = u.role === 'trainer' ? 'entrenador' : 'cliente';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Activar ${roleLabel}`,
        message: `¿Activar a ${label}? El usuario podrá volver a acceder al sistema.`,
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
        next: (res) => {
          if (res !== null) {
            // Update local user status
            this.users = this.users.map(x => x.id === u.id ? { ...x, status: 'ACTIVE' as UserStatus } : x);
            this.allUsers = this.allUsers.map(x => x.id === u.id ? { ...x, status: 'ACTIVE' as UserStatus } : x);
            this.snack.open('Usuario activado', 'Cerrar', { duration: 1800 });
          } else {
            this.snack.open('No se pudo activar', 'Cerrar', { duration: 2500 });
          }
        },
        error: (error) => {
          console.error('activateUser failed', { userId: u.id, error });
          this.snack.open('No se pudo activar', 'Cerrar', { duration: 2500 });
        }
      });
    });
  }

  startEdit(u: AppUser) {
    if (!u) return;
    this.showCreateForm = false;
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
    const userId = u.id;
    const editFormValue = this.editForm.value;
    const payload: AppUser = {
      id: userId,
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
        this.users = this.users.map(x => x.id === userId ? { ...x, ...payload } : x);
        this.allUsers = this.allUsers.map(x => x.id === userId ? { ...x, ...payload } : x);
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
    if (this.isIndependentTenant) return [];
    const currentUser = this.auth.getCurrentUser();
    const companyId = currentUser?.companyId || 'INDEPENDENT';
    return this.allUsers.filter(u => 
      u.role === 'trainer' && 
      (u.companyId === companyId || u.companyId === 'INDEPENDENT') &&
      (u.status || 'ACTIVE') === 'ACTIVE'  // Exclude inactive trainers
    );
  }

  assignTrainer(client: AppUser) {
    if (!this.isAdmin || !this.isClientView || this.isIndependentTenant) return;
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
