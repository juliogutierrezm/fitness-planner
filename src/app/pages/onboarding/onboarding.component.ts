import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService, UserType } from '../../services/auth.service';
import { UserInitializationService } from '../../services/user-initialization.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSnackBarModule
  ],
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.scss']
})
export class OnboardingComponent {
  loading = false;
  selectedUserType: UserType | null = null;

  constructor(
    private authService: AuthService,
    private initService: UserInitializationService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  confirmSelection(): void {
    if (!this.selectedUserType || this.loading) {
      if (!this.selectedUserType) {
        this.snackBar.open('Selecciona un contexto para continuar.', 'Cerrar', { duration: 3000 });
      }
      return;
    }

    this.loading = true;
    this.initService.initializeUser(this.selectedUserType).pipe(
      finalize(() => {
        this.loading = false;
      })
    ).subscribe({
      next: async () => {
        // Refresh auth state to get new groups from Cognito
        await this.authService.checkAuthState(true);
        
        this.snackBar.open('Configuracion completa.', 'Cerrar', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        if (error?.status === 401) {
          this.snackBar.open('No autorizado. Redirigiendo al login...', 'Cerrar', { duration: 4000 });
          this.router.navigate(['/login']);
          return;
        }
        this.snackBar.open('Error al inicializar cuenta.', 'Cerrar', { duration: 4000 });
      }
    });
  }
}


