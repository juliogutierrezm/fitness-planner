import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, FormControl } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AiPlanRequest } from '../../../shared/models';
import { ExerciseApiService } from '../../../exercise-api.service';
import { AuthService } from '../../../services/auth.service';
import { finalize, switchMap, catchError, filter, take, scan } from 'rxjs/operators';
import { timer, of, Subscription, EMPTY } from 'rxjs';

@Component({
  selector: 'app-ai-parametric-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatSliderModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './ai-parametric-dialog.component.html',
  styleUrls: ['./ai-parametric-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiParametricDialogComponent implements OnInit {
  form!: FormGroup;
  isGenerating = false;



  // Purpose: provide trainer-facing experience level definitions for AI filtering.
  // Input/Output: static config consumed by the template for display and selection.
  // Error handling: not applicable (static data).
  // Standards Check: SRP OK | DRY OK | Tests Pending
  difficultyOptions = [
    {
      value: 'Principiante',
      title: 'Principiante',
      purpose: 'Finalidad: proteger al usuario y asegurar una progresion segura con ejercicios basicos y controlados.',
      criteria: [
        '0-12 meses de entrenamiento regular.',
        'Aun aprende la tecnica de movimientos basicos.',
        'Requiere supervision frecuente y evita ejercicios complejos.'
      ],
      nextAction: 'Siguiente accion: priorizar tecnica, ejercicios guiados y volumen moderado.'
    },
    {
      value: 'Intermedio',
      title: 'Intermedio',
      purpose: 'Finalidad: permitir variedad, progresion y estimulos mas exigentes sin comprometer la seguridad.',
      criteria: [
        'Mas de 12 meses entrenando de forma continua.',
        'Ejecuta correctamente la mayoria de los ejercicios comunes.',
        'Tolera mayor volumen e intensidad con supervision ocasional.'
      ],
      nextAction: 'Siguiente accion: introducir variaciones, superseries y progresiones controladas.'
    },
    {
      value: 'Avanzado',
      title: 'Avanzado',
      purpose: 'Finalidad: exponer al usuario a ejercicios complejos y estimulos de alta exigencia de forma segura.',
      criteria: [
        '2-3 anos o mas de entrenamiento constante.',
        'Tecnica solida y consistente.',
        'Entrena de forma autonoma y maneja ejercicios complejos o de alta intensidad.'
      ],
      nextAction: 'Siguiente accion: ampliar variedad con ejercicios complejos y alta intensidad.'
    }
  ];

  trainingGoalOptions = [
    { value: 'Hipertrofia', label: 'Hipertrofia', desc: 'Ganar masa muscular' },
    { value: 'Pérdida de peso', label: 'Pérdida de peso', desc: 'Quemar grasa' },
    { value: 'Resistencia', label: 'Resistencia', desc: 'Mayor resistencia muscular' },
    { value: 'Potencia', label: 'Potencia', desc: 'Fuerza máxima explosiva' },
    { value: 'Funcional', label: 'Funcional', desc: 'Movimientos naturales' },
    { value: 'Cardiovascular', label: 'Cardiovascular', desc: 'Mejorar capacidad cardio' }
  ];

  equipmentOptions = [
    { label: 'Bandas', value: 'Bandas' },
    { label: 'Barra', value: 'Barra' },
    { label: 'Kettlebell', value: 'Kettlebell' },
    { label: 'Mancuernas', value: 'Mancuernas' },
    { label: 'Máquina', value: 'Máquina' },
    { label: 'Peso corporal', value: 'Peso corporal' },
    { label: 'Anillas', value: 'Rings' }
  ];

  muscleGroupOptions = [
    // Musculares
    { label: 'Pectorales', value: 'Pectorales' },
    { label: 'Dorsales', value: 'Dorsales' },
    { label: 'Deltoides', value: 'Deltoides' },
    { label: 'Bíceps', value: 'Bíceps' },
    { label: 'Tríceps', value: 'Tríceps' },
    { label: 'Cuádriceps', value: 'Cuádriceps' },
    { label: 'Isquiotibiales', value: 'Isquiotibiales' },
    { label: 'Glúteos', value: 'Glúteos' },
    { label: 'Pantorrillas', value: 'Pantorrillas' },
    { label: 'Trapecio', value: 'Trapecio' },
    { label: 'Antebrazos', value: 'Antebrazos' },
    { label: 'Core', value: 'Core' },
    // Tipos / categorías
    { label: 'Cardio', value: 'Cardio' },
    { label: 'Mobility', value: 'Mobility' },
    { label: 'Push', value: 'Push' },
    { label: 'Pull', value: 'Pull' },
    { label: 'Squat', value: 'Squat' },
    { label: 'Lunge', value: 'Lunge' },
    { label: 'Hip', value: 'Bend' },
    { label: 'Funcional', value: 'Funcional' }
  ];

  // Purpose: store planner-supplied user context for AI requests.
  // Input/Output: userId/userProfile/userAge set from MAT_DIALOG_DATA, used in payload.
  // Error handling: validated in confirm() before HTTP execution.
  // Standards Check: SRP OK | DRY OK | Tests Pending
  userId: string | null = null;
  userProfile: any = null;
  userAge: number | null = null;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AiParametricDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private api: ExerciseApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {
    this.userId = data?.userId ?? null;
    this.userProfile = data?.userProfile ?? null;
    this.userAge = data?.userAge ?? null;
  }

  ngOnInit() {
    this.initForm();
  }



  private initForm() {
    this.form = this.fb.group({
      // General Data
      difficulty: ['Intermedio', Validators.required],
      trainingGoal: ['Hipertrofia', Validators.required],

      // Availability
      totalSessions: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
      sessionDuration: [60, [Validators.required, Validators.min(30), Validators.max(180)]],
      expectedExercisesPerSession: [8, [Validators.min(4), Validators.max(15)]],

      // Preferences
      availableEquipment: [[]],

      // Session Blueprint
      sessionBlueprint: this.fb.array([]),

      // Custom Notes
      customNotes: ['', [Validators.maxLength(150)]]
    });

    // Watch for totalSessions changes to update session blueprint
    this.form.get('totalSessions')?.valueChanges.subscribe(() => {
      this.updateSessionBlueprint();
    });

    // Initialize session blueprint
    this.updateSessionBlueprint();
  }

  // Purpose: rebuild session blueprint while preserving existing muscle selections and supersets.
  // Input/Output: reads totalSessions + current FormArray values, writes updated FormArray.
  // Error handling: defaults to empty targets and true for includeSupersets when prior values are missing.
  // Standards Check: SRP OK | DRY OK | Tests Pending
  private updateSessionBlueprint() {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    const existingValues = sessionBlueprintArray.controls.map((control) => ({
      targets: Array.isArray(control.get('targets')?.value)
        ? [...(control.get('targets')?.value as string[])]
        : [],
      includeSupersets: control.get('includeSupersets')?.value ?? true
    }));

    const totalSessions = this.form.get('totalSessions')?.value || 1;

    while (sessionBlueprintArray.length > 0) {
      sessionBlueprintArray.removeAt(0);
    }

    for (let i = 0; i < totalSessions; i++) {
      const existingTargets = existingValues[i]?.targets ?? [];
      const existingIncludeSupersets = existingValues[i]?.includeSupersets ?? true;
      sessionBlueprintArray.push(this.fb.group({
        name: [`Sesion ${i + 1}`, Validators.required],
        targets: [existingTargets, Validators.required],
        includeSupersets: [existingIncludeSupersets]
      }));
    }
  }

  getSessionBlueprintControls(): FormGroup[] {
    return (this.form.get('sessionBlueprint') as FormArray).controls as FormGroup[];
  }

  getSessionNameControl(index: number): FormControl {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    return sessionBlueprintArray.at(index).get('name') as FormControl;
  }

  getSessionTargetsControl(index: number): FormControl {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    return sessionBlueprintArray.at(index).get('targets') as FormControl;
  }

  getSessionSupersetsControl(index: number): FormControl {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    return sessionBlueprintArray.at(index).get('includeSupersets') as FormControl;
  }

  removeTarget(sessionIndex: number, target: string) {
    const control = this.getSessionTargetsControl(sessionIndex);
    const current = control.value as string[];
    control.setValue(current.filter(t => t !== target));
  }

  getMuscleLabel(value: string): string {
    const option = this.muscleGroupOptions.find(m => m.value === value);
    return option?.label || value;
  }

  isFormValid(): boolean {
    return this.form.valid && !this.isGenerating;
  }

  close() {
    this.dialogRef.close();
  }

  // Generate plan name from training goal
  generatePlanName(trainingGoal: string): string {
    const goalNames: { [key: string]: string } = {
      'Hipertrofia': 'Plan de Ganancia Muscular',
      'Pérdida de peso': 'Plan de Pérdida de Peso',
      'Resistencia': 'Plan de Resistencia Muscular',
      'Potencia': 'Plan de Fuerza y Potencia',
      'Funcional': 'Plan Funcional',
      'Cardiovascular': 'Plan Cardiovascular'
    };
    return goalNames[trainingGoal] || `Plan de Entrenamiento - ${trainingGoal}`;
  }

  /**
   * Purpose: submit AI plan generation request and notify planner on acceptance.
   * Input/Output: uses form values + user context, closes dialog with {started:true}.
   * Error handling: userId pre-check + snackbar on API failure.
   * Standards Check: SRP OK | DRY OK | Tests Pending.
   */
  confirm() {
    if (!this.isFormValid()) return;

    const formValue = this.form.value;
    const requestStartMs = Date.now();

    // Build userContext only with valid string values
    let userContext: { injuries?: string; notes?: string } | undefined;
    if (this.userProfile) {
      const injuries =
        typeof this.userProfile.injuries === 'string' &&
        this.userProfile.injuries.trim().length > 0
          ? this.userProfile.injuries.trim()
          : undefined;

      const notes =
        typeof this.userProfile.notes === 'string' &&
        this.userProfile.notes.trim().length > 0
          ? this.userProfile.notes.trim()
          : undefined;

      if (injuries || notes) {
        userContext = {};
        if (injuries) userContext.injuries = injuries;
        if (notes) userContext.notes = notes;
      }
    }

    // Build the AI payload with planner-supplied user context
    // companyId is required, trainerId only if user is a trainer (not admin)
    const companyId = this.authService.getCurrentCompanyId();
    if (!companyId) {
      console.error('AI Plan generation blocked: companyId missing');
      this.snackBar.open('No se pudo generar: companyId no disponible.', undefined, { duration: 3500 });
      return;
    }

    const request: AiPlanRequest = {
      gender: this.userProfile?.gender,
      difficulty: formValue.difficulty,
      trainingGoal: formValue.trainingGoal,
      totalSessions: formValue.totalSessions,
      sessionDuration: formValue.sessionDuration,
      availableEquipment: formValue.availableEquipment || [],
      excludeMuscles: formValue.excludeMuscles || [],
      expectedExercisesPerSession: formValue.expectedExercisesPerSession,
      sessionBlueprint: this.buildSessionBlueprint(formValue),
      generalNotes: formValue.customNotes?.trim() || '',
      companyId,
      userId: this.userId || undefined,
      trainerId: this.authService.isTrainer() ? this.authService.getCurrentUserId() : null,
      ...(this.userAge !== null && { age: this.userAge }),
      ...(userContext && { userContext })
    };

    if (!request.userId) {
      console.error('AI Plan generation blocked: userId missing before request', {
        userId: this.userId,
        userProfile: this.userProfile
      });
      this.snackBar.open('No se pudo generar: usuario no asignado.', undefined, { duration: 3500 });
      return;
    }

    // Start plan generation
    this.isGenerating = true;
    console.log('[AI] generatePlanFromAI: request ready', {
      userId: request.userId,
      difficulty: request.difficulty,
      trainingGoal: request.trainingGoal
    });
    this.snackBar.open('Generando plan con IA...', undefined, { duration: 2000 });
    this.cdr.markForCheck();

    this.api.generatePlanFromAI(request)
      .pipe(
        finalize(() => {
          this.isGenerating = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('[AI] generatePlanFromAI accepted', {
            userId: request.userId,
            elapsedMs: Date.now() - requestStartMs,
            response
          });
          // Close dialog and notify planner to start polling
          this.dialogRef.close({ started: true, executionId: response.executionId });
        },
        error: (error) => {
          console.error('[AI] generatePlanFromAI failed to start', {
            userId: request.userId,
            elapsedMs: Date.now() - requestStartMs,
            error
          });
          this.snackBar.open('Error al iniciar la generación del plan. Intenta nuevamente.', undefined, { duration: 3500 });
        }
      });
  }

  private buildSessionBlueprint(formValue: any): { name: string; targets: string[]; includeSupersets: boolean }[] {
    return formValue.sessionBlueprint.map((session: any) => ({
      name: session.name,
      targets: session.targets,
      includeSupersets: session.includeSupersets ?? true
    }));
  }

  // Get form field error messages
  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (field?.hasError('min')) {
      return 'Valor demasiado bajo';
    }
    if (field?.hasError('max')) {
      return 'Valor demasiado alto';
    }
    if (field?.hasError('maxlength')) {
      return 'Texto demasiado largo';
    }
    return '';
  }
}
