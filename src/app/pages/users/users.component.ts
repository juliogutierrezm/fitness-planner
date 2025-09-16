import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { UserApiService, AppUser } from '../../user-api.service';
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
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
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
      givenName: [''],
      familyName: [''],
      role: ['client']
    });
  }

  ngOnInit() {
    this.form = this.formFactory();
    this.editForm = this.formFactory();

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

        if (this.isAdmin) {
          this.api.getUsersByCompany().subscribe(list => { this.users = list; this.cdr.markForCheck(); });
        } else if (user?.role === UserRole.TRAINER) {
          this.api.getUsersByTrainer().subscribe(list => { this.users = list; this.cdr.markForCheck(); });
        } else {
          this.users = [];
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit() {
    if (this.form.invalid) return;
    const payload: AppUser = {
      email: this.form.value.email!,
      givenName: this.form.value.givenName || '',
      familyName: this.form.value.familyName || '',
      role: (this.isAdmin ? this.form.value.role : 'client') as any
    };
    this.api.createUser(payload).subscribe(res => {
      if (res) {
        this.snack.open('Usuario creado', 'Cerrar', { duration: 2000 });
        this.form.reset({ email: '', givenName: '', familyName: '', role: 'client' });
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

  openPlans(u: AppUser) {
    if (!u.id) return;
    this.api.getWorkoutPlansByUserId(u.id).subscribe(list => {
      this.dialog.open(UserPlansDialogComponent, {
        width: '640px',
        data: { user: u, plans: list }
      });
    });
  }

  startEdit(u: AppUser) {
    if (!u) return;
    this.editingId = u.id || null;
    this.editForm.reset({
      email: u.email || '',
      givenName: u.givenName || '',
      familyName: u.familyName || '',
      role: (u.role || 'client') as any
    });
    if (!this.isAdmin) { this.editForm.get('role')?.disable({ emitEvent: false }); }
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveEdit(u: AppUser) {
    if (!this.editingId || !u?.id || this.editForm.invalid) return;
    const payload: AppUser = {
      id: u.id,
      email: this.editForm.get('email')?.value || u.email,
      givenName: this.editForm.get('givenName')?.value || '',
      familyName: this.editForm.get('familyName')?.value || '',
      role: (this.isAdmin ? (this.editForm.get('role')?.value || u.role) : u.role) as any
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
