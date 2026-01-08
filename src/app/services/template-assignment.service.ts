import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

interface TemplateAssignmentOptions {
  userId: string | null | undefined;
  templateId: string | null | undefined;
  snackBar: MatSnackBar;
  onBeforeNavigate?: () => void;
}

@Injectable({ providedIn: 'root' })
export class TemplateAssignmentService {
  constructor(
    private router: Router
  ) {}

  assignTemplateToUser(options: TemplateAssignmentOptions): boolean {
    const userId = options.userId?.trim();
    if (!userId) {
      options.snackBar.open('No se pudo identificar el usuario.', 'Cerrar', { duration: 3000 });
      return false;
    }

    const templateId = options.templateId?.trim();
    if (!templateId) {
      options.snackBar.open('No se pudo identificar la plantilla.', 'Cerrar', { duration: 3000 });
      return false;
    }

    options.onBeforeNavigate?.();
    this.router.navigate(['/planner'], {
      queryParams: { userId, templateId }
    });
    return true;
  }
}
