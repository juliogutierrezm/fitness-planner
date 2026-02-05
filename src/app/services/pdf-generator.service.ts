import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ThemeService, ThemeConfig } from './theme.service';
import { SupportedLocale, detectUserLocale, getLocalizedExerciseName, getPdfLabels } from '../shared/locale.utils';
import { Session, PlanItem } from '../shared/models';
import { PlanProgressions } from '../components/planner/models/planner-plan.model';
import jsPDF from 'jspdf';

export interface PdfPlanData {
  name: string;
  date: string;
  sessions: Session[];
  objective?: string;
  generalNotes?: string;
  progressions?: PlanProgressions | null;
}

export interface PdfGenerationOptions {
  plan: PdfPlanData;
  clientName?: string;
  trainerName?: string;
  locale?: SupportedLocale;
  filename?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PdfGeneratorService {
  // A4 dimensions in mm
  private readonly PAGE_WIDTH = 210;
  private readonly PAGE_HEIGHT = 297;
  private readonly MARGIN = 15;
  private readonly CONTENT_WIDTH = 180; // PAGE_WIDTH - 2*MARGIN

  private pdf!: jsPDF;
  private currentY = 0;
  private theme!: ThemeConfig;
  private labels: ReturnType<typeof getPdfLabels> = getPdfLabels('es');
  private locale: SupportedLocale = 'es';
  private logoBase64: string | null = null;

  constructor(private themeService: ThemeService) {}

  /**
   * Generate and download a PDF from a workout plan.
   * Uses native jsPDF rendering for small file size and clickable links.
   */
  async generatePlanPdf(options: PdfGenerationOptions): Promise<void> {
    const {
      plan,
      clientName = '',
      trainerName = '',
      locale = detectUserLocale(),
      filename
    } = options;

    // Always fetch theme from backend before generating PDF
    try {
      this.theme = await firstValueFrom(this.themeService.getTheme());
    } catch (error) {
      console.warn('[PdfGenerator] Failed to fetch theme from backend:', error);
      // Fallback to cached or neutral colors if backend fails
      this.theme = this.themeService.getRawTheme() || {
        primaryColor: '#333333',
        accentColor: '#666666',
        appName: '',
        tagline: ''
      };
    }

    // Try to load logo from backend URL
    await this.loadLogo();
    
    this.labels = getPdfLabels(locale);
    this.locale = locale;

    // Create PDF
    this.pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    this.currentY = this.MARGIN;

    // Render sections
    this.renderHeader();
    this.renderPlanInfo(plan, clientName, trainerName);
    this.renderSessions(plan.sessions);
    
    if (plan.progressions?.showProgressions && plan.progressions?.weeks?.length) {
      this.renderProgressions(plan.progressions);
    }

    this.renderFooter();

    // Download
    const pdfFilename = filename || this.sanitizeFilename(plan.name);
    this.pdf.save(`${pdfFilename}.pdf`);
  }

  /**
   * Load logo image as base64 for embedding in PDF
   */
  private async loadLogo(): Promise<void> {
    const logoUrl = this.theme.logoUrl;
    if (!logoUrl) {
      this.logoBase64 = null;
      return;
    }

    try {
      // Try to fetch the logo image
      const response = await fetch(logoUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      
      this.logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('[PdfGenerator] Logo loading failed (CORS or network issue):', error);
      this.logoBase64 = null;
    }
  }

  private renderHeader(): void {
    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    
    // Header background (compact - only branding)
    this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.rect(0, 0, this.PAGE_WIDTH, 22, 'F');
    
    // Try to add logo, otherwise just text
    let textStartX = this.MARGIN;
    
    if (this.logoBase64) {
      try {
        const logoHeight = 14;
        const logoWidth = 14;
        this.pdf.addImage(this.logoBase64, 'PNG', this.MARGIN, 4, logoWidth, logoHeight);
        textStartX = this.MARGIN + logoWidth + 3;
      } catch (error) {
        console.warn('[PdfGenerator] Failed to add logo to PDF:', error);
      }
    }
    
    // App name
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(this.theme.appName || '', textStartX, 10);

    // Tagline (below app name) - same color as app name
    const tagline = this.theme.tagline || '';
    if (tagline) {
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text(tagline, textStartX, 16);
    }

    this.currentY = 28;
  }

  private renderPlanInfo(plan: PdfPlanData, clientName: string, trainerName: string): void {
    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    
    // Plan name with accent color
    this.pdf.setFontSize(13);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.text(plan.name, this.MARGIN, this.currentY);
    
    // Date right aligned
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(this.formatDate(plan.date), this.PAGE_WIDTH - this.MARGIN, this.currentY, { align: 'right' });
    this.currentY += 6;

    // Client and Trainer in the same row (larger font)
    const hasClient = !!clientName;
    const hasTrainer = !!trainerName;
    
    if (hasClient || hasTrainer) {
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(80, 80, 80);
      
      const parts: string[] = [];
      if (hasClient) {
        parts.push(`${this.labels.client}: ${clientName}`);
      }
      if (hasTrainer) {
        parts.push(`${this.labels.trainer}: ${trainerName}`);
      }
      
      this.pdf.text(parts.join('   |   '), this.MARGIN, this.currentY);
      this.currentY += 5;
    }

    // Objective and General Notes in a single compact row
    const hasObjective = !!plan.objective;
    const hasNotes = !!plan.generalNotes;
    
    if (hasObjective || hasNotes) {
      this.checkPageBreak(15);
      this.currentY += 2;
      this.renderCompactInfoRow(plan.objective, plan.generalNotes);
    }

    this.currentY += 4;
  }

  /**
   * Render objective and general notes side by side in a compact row
   */
  private renderCompactInfoRow(objective?: string, generalNotes?: string): void {
    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    const hasObjective = !!objective;
    const hasNotes = !!generalNotes;
    
    // Calculate widths based on content
    const boxWidth = hasObjective && hasNotes 
      ? (this.CONTENT_WIDTH - 4) / 2 
      : this.CONTENT_WIDTH;
    
    const boxHeight = 14;

    // Objective box (left or full width)
    if (hasObjective) {
      const objX = this.MARGIN;
      
      // Left accent border
      this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      this.pdf.rect(objX, this.currentY - 3, 2, boxHeight, 'F');
      
      // Background
      this.pdf.setFillColor(249, 250, 251);
      this.pdf.rect(objX + 2, this.currentY - 3, boxWidth - 2, boxHeight, 'F');
      
      // Label
      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      this.pdf.text(this.labels.objective.toUpperCase(), objX + 5, this.currentY);
      
      // Content
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(55, 65, 81);
      const objText = this.truncateText(objective!, boxWidth - 12);
      this.pdf.text(objText, objX + 5, this.currentY + 6);
    }

    // General notes box (right or full width)
    if (hasNotes) {
      const notesX = hasObjective ? this.MARGIN + boxWidth + 4 : this.MARGIN;
      const notesWidth = hasObjective ? boxWidth : this.CONTENT_WIDTH;
      
      // Left accent border
      this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      this.pdf.rect(notesX, this.currentY - 3, 2, boxHeight, 'F');
      
      // Background
      this.pdf.setFillColor(249, 250, 251);
      this.pdf.rect(notesX + 2, this.currentY - 3, notesWidth - 2, boxHeight, 'F');
      
      // Label
      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      this.pdf.text(this.labels.generalNotes.toUpperCase(), notesX + 5, this.currentY);
      
      // Content
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(55, 65, 81);
      const notesText = this.truncateText(generalNotes!, notesWidth - 12);
      this.pdf.text(notesText, notesX + 5, this.currentY + 6);
    }

    this.currentY += boxHeight;
  }

  private renderSessions(sessions: Session[]): void {
    sessions.forEach((session, index) => {
      this.checkPageBreak(30);
      this.renderSessionHeader(session.name, index + 1);
      this.renderExerciseTable(session.items);
      this.currentY += 8;
    });
  }

  private renderSessionHeader(name: string, _number: number): void {
    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    
    // Header background
    this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.rect(this.MARGIN, this.currentY, this.CONTENT_WIDTH, 8, 'F');

    // Session title - only show name
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(name, this.MARGIN + 3, this.currentY + 5.5);

    this.currentY += 10;
  }

  private renderExerciseTable(items: PlanItem[]): void {
    // Table header
    this.renderTableHeader();

    // Table rows
    items.forEach(item => {
      if (item.isGroup && item.children?.length) {
        this.renderSupersetBlock(item);
      } else {
        this.checkPageBreak(8);
        this.renderExerciseRow(item, false);
      }
    });
  }

  private renderTableHeader(): void {
    this.pdf.setFillColor(243, 244, 246);
    this.pdf.rect(this.MARGIN, this.currentY, this.CONTENT_WIDTH, 6, 'F');

    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(107, 114, 128);

    const cols = this.getColumnPositions();
    this.pdf.text(this.labels.exercise.toUpperCase(), cols.exercise, this.currentY + 4);
    this.pdf.text(this.labels.equipment.toUpperCase(), cols.equipment, this.currentY + 4);
    this.pdf.text(this.labels.sets.toUpperCase(), cols.sets, this.currentY + 4);
    this.pdf.text(this.labels.reps.toUpperCase(), cols.reps, this.currentY + 4);
    this.pdf.text(this.labels.rest.toUpperCase(), cols.rest, this.currentY + 4);
    this.pdf.text(this.labels.weight.toUpperCase(), cols.weight, this.currentY + 4);
    this.pdf.text('VIDEO', cols.video, this.currentY + 4);

    this.currentY += 7;
  }

  private getColumnPositions() {
    return {
      exercise: this.MARGIN + 2,
      equipment: this.MARGIN + 58,
      sets: this.MARGIN + 90,
      reps: this.MARGIN + 103,
      rest: this.MARGIN + 118,
      weight: this.MARGIN + 135,
      video: this.MARGIN + 152
    };
  }

  private renderExerciseRow(item: PlanItem, isSuperset: boolean): void {
    const cols = this.getColumnPositions();
    const rowHeight = 7;
    const primaryColor = this.hexToRgb(this.theme.primaryColor);

    // Alternate row background for supersets
    if (isSuperset) {
      this.pdf.setFillColor(240, 249, 255);
      this.pdf.rect(this.MARGIN, this.currentY - 1, this.CONTENT_WIDTH, rowHeight, 'F');
    }

    // Row border
    this.pdf.setDrawColor(243, 244, 246);
    this.pdf.line(this.MARGIN, this.currentY + rowHeight - 2, this.MARGIN + this.CONTENT_WIDTH, this.currentY + rowHeight - 2);

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(30, 30, 50);

    // Exercise name
    const exerciseName = getLocalizedExerciseName(item, this.locale);
    const maxNameWidth = 53;
    const truncatedName = this.truncateText(exerciseName, maxNameWidth);
    this.pdf.text(truncatedName, cols.exercise, this.currentY + 4);

    // Equipment
    const equipment = item.equipment_type || '-';
    const truncatedEquip = this.truncateText(equipment, 28);
    this.pdf.text(truncatedEquip, cols.equipment, this.currentY + 4);

    // Sets, Reps, Rest, Weight (no units for weight)
    this.pdf.text(String(item.sets || '-'), cols.sets, this.currentY + 4);
    this.pdf.text(String(item.reps || '-'), cols.reps, this.currentY + 4);
    this.pdf.text(item.rest ? `${item.rest}s` : '-', cols.rest, this.currentY + 4);
    this.pdf.text(item.weight ? String(item.weight) : '-', cols.weight, this.currentY + 4);

    // Video link - always show "VER VIDEO" text
    if (item.youtube_url) {
      const accentColor = this.hexToRgb(this.theme.accentColor);
      const videoText = 'VER VIDEO';
      this.pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(videoText, cols.video, this.currentY + 4);
      
      // Add clickable link
      const textWidth = this.pdf.getTextWidth(videoText);
      this.pdf.link(cols.video, this.currentY, textWidth + 2, rowHeight, { url: item.youtube_url });
      
      // Reset styles
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(30, 30, 50);
    } else {
      this.pdf.text('-', cols.video, this.currentY + 4);
    }

    this.currentY += rowHeight;
  }

  private renderSupersetBlock(group: PlanItem): void {
    this.checkPageBreak(10 + (group.children?.length || 0) * 7);

    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    const accentColor = this.hexToRgb(this.theme.accentColor);
    
    // Superset header with accent color background
    this.pdf.setFillColor(240, 249, 255);
    this.pdf.rect(this.MARGIN, this.currentY, this.CONTENT_WIDTH, 6, 'F');

    // Left border with accent color
    this.pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    this.pdf.rect(this.MARGIN, this.currentY, 2, 6, 'F');

    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    this.pdf.text(`${this.labels.superset.toUpperCase()}`, this.MARGIN + 5, this.currentY + 4);

    this.currentY += 7;

    // Render children
    group.children?.forEach(child => {
      this.checkPageBreak(8);
      this.renderExerciseRow(child, true);
    });
  }

  private renderProgressions(progressions: PlanProgressions): void {
    this.checkPageBreak(25);

    const primaryColor = this.hexToRgb(this.theme.primaryColor);
    const accentColor = this.hexToRgb(this.theme.accentColor);

    // Header
    this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.rect(this.MARGIN, this.currentY, this.CONTENT_WIDTH, 8, 'F');

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(
      `${this.labels.progressions} (${progressions.totalWeeks} ${this.labels.weeks})`,
      this.MARGIN + 3,
      this.currentY + 5.5
    );

    this.currentY += 12;

    // Weeks
    progressions.weeks?.forEach(week => {
      this.checkPageBreak(15);

      // Week header - use accent color for week indicator
      this.pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
      this.pdf.rect(this.MARGIN, this.currentY, 2, 10, 'F');

      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
      this.pdf.text(`${this.labels.week} ${week.week}`, this.MARGIN + 5, this.currentY + 4);

      if (week.title) {
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setTextColor(107, 114, 128);
        this.pdf.text(`- ${week.title}`, this.MARGIN + 30, this.currentY + 4);
      }

      // Week note
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(55, 65, 81);
      const noteLines = this.pdf.splitTextToSize(week.note, this.CONTENT_WIDTH - 10);
      this.pdf.text(noteLines, this.MARGIN + 5, this.currentY + 9);

      this.currentY += 12 + (noteLines.length - 1) * 4;
    });
  }

  private renderFooter(): void {
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(156, 163, 175);

    const footerY = this.PAGE_HEIGHT - 10;
    this.pdf.text(
      'Generated with SpeedUp Coach',
      this.MARGIN,
      footerY
    );
    this.pdf.text(
      new Date().toLocaleDateString(this.locale === 'es' ? 'es-ES' : 'en-US'),
      this.PAGE_WIDTH - this.MARGIN,
      footerY,
      { align: 'right' }
    );
  }

  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.PAGE_HEIGHT - 20) {
      this.pdf.addPage();
      this.currentY = this.MARGIN;
    }
  }

  private truncateText(text: string, maxWidth: number): string {
    const width = this.pdf.getTextWidth(text);
    if (width <= maxWidth) return text;

    let truncated = text;
    while (this.pdf.getTextWidth(truncated + '...') > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(this.locale === 'es' ? 'es-ES' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 14, g: 165, b: 233 };
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }

  private sanitizeFilename(name: string): string {
    return (name || 'workout-plan')
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü\s-]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Build PdfPlanData from various plan formats.
   */
  buildPdfPlanData(
    name: string,
    date: string,
    sessions: Session[],
    options?: {
      objective?: string;
      generalNotes?: string;
      progressions?: PlanProgressions | null;
    }
  ): PdfPlanData {
    return {
      name,
      date,
      sessions,
      objective: options?.objective,
      generalNotes: options?.generalNotes,
      progressions: options?.progressions
    };
  }
}
