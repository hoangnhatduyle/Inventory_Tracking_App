import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

interface DialogData {
  tableName: string;
  row: Record<string, any>;
  columns: { name: string; type: string; notnull: boolean; pk: boolean }[];
}

@Component({
  selector: 'app-row-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>edit</mat-icon>
      Edit Row (ID: {{ data.row['id'] }})
    </h2>

    <mat-dialog-content>
      <div class="edit-form">
        <div *ngFor="let column of data.columns" class="form-field">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ column.name }}</mat-label>
            <input matInput
                   [(ngModel)]="editedRow[column.name]"
                   [disabled]="column.pk"
                   [placeholder]="column.type">
            <mat-hint *ngIf="column.pk">Primary key (read-only)</mat-hint>
            <mat-hint *ngIf="column.notnull && !column.pk">Required</mat-hint>
          </mat-form-field>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" style="padding: 1rem;">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSave()">
        <mat-icon>save</mat-icon>
        Save Changes
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;

      mat-icon {
        color: var(--primary-color, #4CAF50);
      }
    }

    mat-dialog-content {
      max-height: 60vh;
      overflow-y: auto;
    }

    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .form-field {
      width: 100%;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-actions {
      padding: 1rem 0 0 0;
      margin: 0;

      button {
        mat-icon {
          margin-right: 0.25rem;
        }
      }
    }
  `]
})
export class RowEditDialogComponent {
  editedRow: Record<string, any>;

  constructor(
    public dialogRef: MatDialogRef<RowEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.editedRow = { ...data.row };
  }

  onCancel() {
    this.dialogRef.close(null);
  }

  onSave() {
    this.dialogRef.close(this.editedRow);
  }
}
