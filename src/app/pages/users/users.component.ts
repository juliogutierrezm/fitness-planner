import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
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
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { UserApiService, AppUser, CreateUserWithRoleRequest } from '../../user-api.service';
import { AuthService, UserRole } from '../../services/auth.service';

import { UserPlansDialogComponent } from '../user-plans-dialog/user-plans-dialog.component';
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
    MatProgressSpinnerModule,
    RouterModule,
    MatTooltipModule
  ],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
  users: AppUser[] = [];
  form!: FormGroup;
  canCreate = false;
  isAdmin = false;
  editingId: string | null = null;
  editForm!: FormGroup;
  isLoading = false;
  showCreateForm = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private api: UserApiService,
    private auth: AuthService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  private formFactory() {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      givenName: ['', Validators.required],
      familyName: ['', Validators.required],
      telephone: [''],
      gender: [''],
      role: ['client'],
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
        this.isAdmin = user?.role === UserRole.ADMIN;
        this.canCreate = this.api.canCreateUsers();

        if (this.isAdmin) {
          this.form.get('role')?.enable({ emitEvent: false });
        } else {
          this.form.get('role')?.disable({ emitEvent: false });
        }

        this.isLoading = true;
        this.cdr.markForCheck();

        const canManageUsers = user?.role === UserRole.ADMIN || user?.role === UserRole.TRAINER;
        if (canManageUsers) {
          this.api.getUsersForCurrentTenant().subscribe(list => {
            this.users = list;
            this.isLoading = false;
            this.cdr.markForCheck();
          });
        } else {
          this.users = [];
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
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

  submit() {
    if (this.form.invalid) return;
    const formValue = this.form.value;
    const role = (this.isAdmin ? formValue.role : 'client') as 'client' | 'trainer';
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
    this.api.createUser(payload).subscribe(res => {
      if (res) {
        this.snack.open('Usuario creado', 'Cerrar', { duration: 2000 });
        this.form.reset({ email: '', givenName: '', familyName: '', telephone: '', gender: '', role: 'client', dateOfBirth: '', noInjuries: true, injuries: '', notes: '' });
        this.showCreateForm = false;
        this.ngOnInit();
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
      role: (u.role || 'client') as any,
      dateOfBirth: u.dateOfBirth || '',
      noInjuries: u.noInjuries ?? false, // Default to false if not set
      injuries: u.injuries || '',
      notes: u.notes || ''
    });
    // Disable email field to prevent editing
    this.editForm.get('email')?.disable({ emitEvent: false });
    if (!this.isAdmin) { this.editForm.get('role')?.disable({ emitEvent: false }); }
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveEdit(u: AppUser) {
    if (!this.editingId || !u?.id || this.editForm.invalid) return;
    const editFormValue = this.editForm.value;
    const payload: AppUser = {
      id: u.id,
      email: u.email!, // Keep original email, don't allow changes
      givenName: editFormValue.givenName || '',
      familyName: editFormValue.familyName || '',
      telephone: editFormValue.telephone || '',
      gender: editFormValue.gender || u.gender,
      role: (this.isAdmin ? editFormValue.role || u.role : u.role) as any,
      dateOfBirth: editFormValue.dateOfBirth || u.dateOfBirth,
      noInjuries: editFormValue.noInjuries,
      injuries: editFormValue.noInjuries ? null : (editFormValue.injuries?.trim() || null),
      notes: editFormValue.notes || u.notes
    };
    this.api.updateUser(payload).subscribe(res => {
      if (res !== null) {
        this.users = this.users.map(x => x.id === u.id ? { ...x, ...payload } : x);
        this.editingId = null;
        this.cdr.markForCheck();
        this.snack.open('Usuario actualizado', 'Cerrar', { duration: 1800 });
      } else {
        this.snack.open('No se pudo actualizar', 'Cerrar', { duration: 2500 });
      }
    });
  }
}
