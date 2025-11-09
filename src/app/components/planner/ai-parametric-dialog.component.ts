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

export interface WorkoutPlanParams {
  gender: 'Masculino' | 'Femenino';
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado' | 'Élite' | 'Recuperación';
  trainingGoal: 'Hipertrofia' | 'Pérdida de peso' | 'Resistencia' | 'Potencia' | 'Funcional' | 'Cardiovascular';
  daysPerWeek: number;
  sessionDuration: number;
  availableEquipment: string[];
  includeSupersets: boolean;
  excludeMuscles: string[];
  planStructure: 'Torso-Pierna' | 'Full-Body' | 'Funcional' | 'Personalizado';
  customStructure?: { [day: string]: string[] };
  customNotes?: string;
}

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

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AiParametricDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
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
      daysPerWeek: [3, [Validators.required, Validators.min(1), Validators.max(7)]],
      sessionDuration: [60, [Validators.required, Validators.min(30), Validators.max(180)]],

      // Preferences
      availableEquipment: [[]],
      includeSupersets: [true],
      excludeMuscles: [[]],

      // Structure
      planStructure: ['Torso-Pierna', Validators.required],
      customStructure: this.fb.group({}),

      // Custom Notes
      customNotes: ['', [Validators.maxLength(150)]]
    });

    // Watch for plan structure changes to show/hide custom structure
    this.form.get('planStructure')?.valueChanges.subscribe(value => {
      this.updateCustomStructure(value);
    });

    // Watch for days per week changes to update custom structure
    this.form.get('daysPerWeek')?.valueChanges.subscribe(() => {
      if (this.form.get('planStructure')?.value === 'Personalizado') {
        this.updateCustomStructure('Personalizado');
      }
    });

    // Initialize custom structure for default selection
    this.updateCustomStructure(this.form.get('planStructure')?.value);
  }

  private updateCustomStructure(planStructure: string) {
    const customStructureGroup = this.form.get('customStructure') as FormGroup;

    // Clear existing controls
    Object.keys(customStructureGroup.controls).forEach(key => {
      customStructureGroup.removeControl(key);
    });

    if (planStructure === 'Personalizado') {
      const daysPerWeek = this.form.get('daysPerWeek')?.value || 3;
      for (let i = 1; i <= daysPerWeek; i++) {
        customStructureGroup.addControl(
          `day${i}`,
          this.fb.control([], Validators.required)
        );
      }
    }
  }

  getCustomStructureDays(): string[] {
    const daysPerWeek = this.form.get('daysPerWeek')?.value || 3;
    return Array.from({ length: daysPerWeek }, (_, i) => `day${i + 1}`);
  }

  getCustomStructureDayLabel(dayKey: string): string {
    const dayNumber = dayKey.replace('day', '');
    return `Día ${dayNumber}`;
  }

  getCustomDayControl(dayKey: string): FormControl {
    return this.form.get(`customStructure.${dayKey}`) as FormControl;
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

    // Build the params object for Lambda
    const params: WorkoutPlanParams = {
      gender: formValue.gender,
      difficulty: formValue.difficulty,
      trainingGoal: formValue.trainingGoal,
      daysPerWeek: formValue.daysPerWeek,
      sessionDuration: formValue.sessionDuration,
      availableEquipment: formValue.availableEquipment || [],
      includeSupersets: formValue.includeSupersets,
      excludeMuscles: formValue.excludeMuscles || [],
      planStructure: formValue.planStructure,
      customNotes: formValue.customNotes?.trim() || undefined
    };

    // Add custom structure if applicable
    if (formValue.planStructure === 'Personalizado' && formValue.customStructure) {
      params.customStructure = {};
      Object.keys(formValue.customStructure).forEach(dayKey => {
        const dayNumber = dayKey.replace('day', '');
        params.customStructure![`Día ${dayNumber}`] = formValue.customStructure[dayKey] || [];
      });
    }

    // Prepare data for subsequent forms (plan editing/saving)
    const planFormData = {
      name: this.generatePlanName(formValue.trainingGoal),
      objective: formValue.trainingGoal,
      sessions: formValue.daysPerWeek,
      generalNotes: formValue.customNotes?.trim() || ''
    };

    this.isGenerating = true;
    this.dialogRef.close({
      params,
      generalNotes: params.customNotes,
      planFormData
    });
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
