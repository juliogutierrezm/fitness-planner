import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-user-plans-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, RouterModule],
  templateUrl: './user-plans-dialog.component.html',
  styleUrls: ['./user-plans-dialog.component.scss']
})
export class UserPlansDialogComponent { 
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {} 
}
