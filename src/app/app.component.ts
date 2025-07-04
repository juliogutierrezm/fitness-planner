import { Component } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { PlannerComponent } from './components/planner/planner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    PlannerComponent
  ],
  template: `<app-planner></app-planner>`
})
export class AppComponent {}
