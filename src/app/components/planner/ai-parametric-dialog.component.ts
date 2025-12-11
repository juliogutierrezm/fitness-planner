import { Component, Inject, OnInit } from '@angular/core';
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
import { AiPlanRequest } from '../../shared/models';
import { ExerciseApiService } from '../../exercise-api.service';
import { AuthService } from '../../services/auth.service';

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
  styleUrls: ['./ai-parametric-dialog.component.scss']
})
export class AiParametricDialogComponent implements OnInit {
  form!: FormGroup;
  isGenerating = false;

  // Form options
  genderOptions = [
    { value: 'Masculino', label: 'Masculino' },
    { value: 'Femenino', label: 'Femenino' }
  ];

  difficultyOptions = [
    { value: 'Principiante', label: 'Principiante', desc: 'Nuevo en el entrenamiento' },
    { value: 'Intermedio', label: 'Intermedio', desc: '6-12 meses de experiencia' },
    { value: 'Avanzado', label: 'Avanzado', desc: '1-3 años de experiencia' },
    { value: 'Élite', label: 'Élite', desc: 'Más de 3 años, atleta' },
    { value: 'Recuperación', label: 'Recuperación', desc: 'Vuelta al entrenamiento' }
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
    'Mancuernas', 'Barras', 'Máquinas', 'Bandas elásticas', 'Pesas rusas',
    'TRX', 'Anillas', 'Banco', 'Rack de sentadillas', 'Sin equipo'
  ];

  muscleGroupOptions = [
    'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps',
    'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Pantorrillas', 'Core'
  ];

  planStructureOptions = [
    { value: 'Torso-Pierna', label: 'Torso-Pierna', desc: 'Día torso + día piernas' },
    { value: 'Full-Body', label: 'Full-Body', desc: 'Todo el cuerpo cada día' },
    { value: 'Funcional', label: 'Funcional', desc: 'Movimientos naturales' },
    { value: 'Personalizado', label: 'Personalizado', desc: 'Configura manualmente' }
  ];

  cardioPlacementOptions = [
    { value: 'inicio', label: 'Inicio', desc: 'Al inicio de la sesión' },
    { value: 'medio', label: 'Medio', desc: 'En el medio de la sesión' },
    { value: 'fin', label: 'Fin', desc: 'Al final de la sesión' }
  ];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AiParametricDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private api: ExerciseApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.initForm();
  }

  private initForm() {
    this.form = this.fb.group({
      // General Data
      gender: ['Masculino', Validators.required],
      difficulty: ['Intermedio', Validators.required],
      trainingGoal: ['Hipertrofia', Validators.required],

      // Availability
      totalSessions: [4, [Validators.required, Validators.min(1), Validators.max(8)]],
      sessionDuration: [60, [Validators.required, Validators.min(30), Validators.max(180)]],
      expectedExercisesPerSession: [8, [Validators.min(4), Validators.max(20)]],

      // Preferences
      availableEquipment: [[]],
      includeSupersets: [true],
      excludeMuscles: [[]],
      includeMobility: [true],
      includeCardio: [false],
      cardioPlacement: ['medio'],
      cardioDuration: [10, [Validators.min(5), Validators.max(30)]],

      // Structure
      planStructure: ['Torso-Pierna', Validators.required],
      sessionBlueprint: this.fb.array([]),

      // Custom Notes
      customNotes: ['', [Validators.maxLength(150)]]
    });

    // Watch for plan structure changes to show/hide session blueprint
    this.form.get('planStructure')?.valueChanges.subscribe(value => {
      this.updateSessionBlueprint(value);
    });

    // Watch for totalSessions changes to update session blueprint
    this.form.get('totalSessions')?.valueChanges.subscribe(() => {
      if (this.form.get('planStructure')?.value === 'Personalizado') {
        this.updateSessionBlueprint('Personalizado');
      }
    });

    // Initialize session blueprint for default selection
    this.updateSessionBlueprint(this.form.get('planStructure')?.value);
  }

  private updateSessionBlueprint(planStructure: string) {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;

    // Clear existing controls
    while (sessionBlueprintArray.length > 0) {
      sessionBlueprintArray.removeAt(0);
    }

    if (planStructure === 'Personalizado') {
      const totalSessions = this.form.get('totalSessions')?.value || 4;
      for (let i = 1; i <= totalSessions; i++) {
        sessionBlueprintArray.push(this.fb.group({
          name: [`Sesión ${i}`, Validators.required],
          muscleGroups: [[], Validators.required]
        }));
      }
    }
  }

  getSessionBlueprintControls(): FormGroup[] {
    return (this.form.get('sessionBlueprint') as FormArray).controls as FormGroup[];
  }

  getSessionNameControl(index: number): FormControl {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    return sessionBlueprintArray.at(index).get('name') as FormControl;
  }

  getSessionMuscleGroupsControl(index: number): FormControl {
    const sessionBlueprintArray = this.form.get('sessionBlueprint') as FormArray;
    return sessionBlueprintArray.at(index).get('muscleGroups') as FormControl;
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

  confirm() {
    if (!this.isFormValid()) return;

    const formValue = this.form.value;

    // Build the AiPlanRequest object for the backend
    const request: AiPlanRequest = {
      gender: formValue.gender,
      difficulty: formValue.difficulty,
      trainingGoal: formValue.trainingGoal,
      totalSessions: formValue.totalSessions,
      sessionDuration: formValue.sessionDuration,
      availableEquipment: formValue.availableEquipment || [],
      excludeMuscles: formValue.excludeMuscles || [],
      includeSupersets: formValue.includeSupersets,
      includeMobility: formValue.includeMobility,
      includeCardio: formValue.includeCardio,
      expectedExercisesPerSession: formValue.expectedExercisesPerSession,
      sessionBlueprint: this.buildSessionBlueprint(formValue),
      generalNotes: formValue.customNotes?.trim() || '',
      userId: this.authService.getCurrentUserId() || undefined
    };

    // Show generating state
    this.isGenerating = true;

    // Send POST request to start plan generation
    this.api.generatePlanFromAI(request).subscribe({
      next: (response) => {
        if (response.executionArn) {
          // Return executionArn to planner for polling
          this.dialogRef.close({
            executionArn: response.executionArn,
            planFormData: {
              name: this.generatePlanName(formValue.trainingGoal),
              objective: formValue.trainingGoal,
              sessions: formValue.totalSessions,
              generalNotes: request.generalNotes
            }
          });
        } else {
          console.error('No executionArn received from backend');
          this.isGenerating = false;
        }
      },
      error: (error) => {
        console.error('Error starting plan generation:', error);
        this.isGenerating = false;
      }
    });
  }

  private buildSessionBlueprint(formValue: any): { name: string; muscleGroups: string[] }[] {
    if (formValue.planStructure === 'Personalizado' && formValue.sessionBlueprint) {
      return formValue.sessionBlueprint;
    }

    // For pre-defined structures, create basic session blueprints
    const blueprints: { name: string; muscleGroups: string[] }[] = [];
    for (let i = 1; i <= formValue.totalSessions; i++) {
      blueprints.push({
        name: `Sesión ${i}`,
        muscleGroups: [] // Let the backend decide the structure
      });
    }
    return blueprints;
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
