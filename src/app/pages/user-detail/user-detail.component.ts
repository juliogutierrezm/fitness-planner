import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { UserApiService, AppUser } from '../../user-api.service';
import { ExerciseApiService } from '../../exercise-api.service';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailComponent implements OnInit {
  userId: string | null = null;
  user: AppUser | null = null;
  plans: any[] = [];
  loadingPlans = false;

  constructor(
    private route: ActivatedRoute,
    private userApi: UserApiService,
    private planApi: ExerciseApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId) return;

    this.userApi.getUserById(this.userId).subscribe(u => {
      this.user = u;
      this.cdr.markForCheck();
    });

    this.loadingPlans = true;
    this.userApi.getWorkoutPlansByUserId(this.userId).subscribe(
      list => {
        this.plans = (list || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.loadingPlans = false;
        this.cdr.markForCheck();
      },
      _ => {
        this.loadingPlans = false;
        this.cdr.markForCheck();
      }
    );
  }

  getPlanId(p: any): string {
    if (p?.planId) return p.planId;
    if (p?.id) return p.id;
    if (p?.SK && typeof p.SK === 'string' && p.SK.startsWith('PLAN#')) {
      return p.SK.substring(5);
    }
    return '';
  }
}
