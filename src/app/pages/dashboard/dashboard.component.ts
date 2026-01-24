import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, MatCardModule, MatIconModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  displayName = 'Entrenador';
  metrics = {
    assignedClientsLabel: '—',
    totalPlansLabel: '—',
    templatesLabel: '—',
    activePlansLabel: '—',
    aiPendingLabel: '—'
  };
  recentActivity: Array<{ icon: string; title: string; description: string; timestamp: string }> = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (!user) {
          this.displayName = 'Entrenador';
          return;
        }
        const fullName = `${user.givenName || ''} ${user.familyName || ''}`.trim();
        this.displayName = fullName || user.email || 'Entrenador';
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
