import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ThemeService, ThemeConfig } from '../../services/theme.service';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './appearance-settings.component.html',
  styleUrls: ['./appearance-settings.component.scss']
})
export class AppearanceSettingsComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isLoading = false;
  isSaving = false;
  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  typographyOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Montserrat', label: 'Montserrat' },
    { value: 'Oswald', label: 'Oswald' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private themeService: ThemeService,
    private snackBar: MatSnackBar
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Load theme immediately, interceptor will add token if available
    this.loadTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      primaryColor: ['#FF9900', [Validators.required]],
      accentColor: ['#22D3EE', [Validators.required]],
      darkMode: [false],
      typography: ['Inter', [Validators.required]],
      appName: ['', [Validators.maxLength(40)]],
      tagline: ['', [Validators.maxLength(80)]]
    });

    // Subscribe to form changes to update preview in real-time
    this.form.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updatePreview());
  }

  private loadTheme(): void {
    this.isLoading = true;
    this.themeService.loadTheme()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (config) => {
          // Map backend fields to UI fields
          const darkMode = config.backgroundMode === 'dark';
          const typography = config.fontFamily || 'Inter';

          this.form.patchValue({
            primaryColor: config.primaryColor,
            accentColor: config.accentColor,
            darkMode: darkMode,
            typography: typography,
            appName: config.appName || '',
            tagline: config.tagline || ''
          });
          if (config.logoUrl) {
            this.logoPreviewUrl = config.logoUrl;
          }
          this.isLoading = false;
          this.updatePreview();
        },
        error: (error) => {
          console.error('Failed to load theme:', error);
          this.isLoading = false;
          // Form already has defaults, just update preview
          this.updatePreview();
        }
      });
  }

  private updatePreview(): void {
    const config = this.form.getRawValue();
    // Preview is now handled via inline styles in the template only
    // No global application of theme
  }

  onLogoSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.snackBar.open('Por favor selecciona un archivo de imagen', 'Cerrar', {
          duration: 3000
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.snackBar.open('El archivo no debe superar 5MB', 'Cerrar', {
          duration: 3000
        });
        return;
      }

      this.logoFile = file;

      // Show preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        this.logoPreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  private async uploadLogo(): Promise<string | null> {
    if (!this.logoFile) {
      return null;
    }

    try {
      // Get pre-signed URL from backend with filename and contentType
      const response = await this.themeService.getLogoUploadUrl(
        this.logoFile.name,
        this.logoFile.type
      ).toPromise();
      if (!response?.uploadUrl || !response?.fileKey) {
        throw new Error('Failed to get upload URL');
      }

      // Upload directly to S3 using fetch
      await this.themeService.uploadLogoToS3(response.uploadUrl, this.logoFile);

      // Return the fileKey for saving in the theme config
      return response.fileKey;
    } catch (error) {
      console.error('Error uploading logo:', error);
      this.snackBar.open('Error al cargar el logo. Por favor intenta de nuevo.', 'Cerrar', {
        duration: 3000
      });
      throw error;
    }
  }

  async saveChanges(): Promise<void> {
    if (this.form.invalid) {
      this.snackBar.open('Por favor completa todos los campos correctamente', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.isSaving = true;

    try {
      let logoKey: string | null = null;

      // Upload logo if a new one was selected
      if (this.logoFile) {
        logoKey = await this.uploadLogo();
      }

      const formValue = this.form.getRawValue();
      
      // Map UI fields to backend fields
      const config: ThemeConfig = {
        primaryColor: formValue.primaryColor,
        accentColor: formValue.accentColor,
        backgroundMode: formValue.darkMode ? 'dark' : 'light',
        fontFamily: formValue.typography
      };

      // Add optional fields if they have values
      if (formValue.appName) config.appName = formValue.appName;
      if (formValue.tagline) config.tagline = formValue.tagline;

      // Only add logoKey if a new logo was uploaded
      if (logoKey) {
        config.logoKey = logoKey;
      }

      // Save to server only (no global application)
      await this.themeService.saveTheme(config).toPromise();

      this.snackBar.open('Cambios guardados correctamente', 'Cerrar', {
        duration: 3000
      });

      // Reset logo file after successful save
      this.logoFile = null;
    } catch (error) {
      console.error('Error saving theme:', error);
      this.snackBar.open('Error al guardar los cambios. Por favor intenta de nuevo.', 'Cerrar', {
        duration: 3000
      });
    } finally {
      this.isSaving = false;
    }
  }

  resetToDefaults(): void {
    const defaultTheme = this.themeService.getDefaultTheme();
    const darkMode = defaultTheme.backgroundMode === 'dark';
    const typography = defaultTheme.fontFamily || 'Inter';

    this.form.patchValue({
      primaryColor: defaultTheme.primaryColor,
      accentColor: defaultTheme.accentColor,
      darkMode: darkMode,
      typography: typography,
      appName: '',
      tagline: ''
    });
    this.logoFile = null;
    this.logoPreviewUrl = defaultTheme.logoUrl || null;
    // updatePreview() called via valueChanges subscription
  }
}
