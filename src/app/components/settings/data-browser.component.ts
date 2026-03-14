import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatabaseService } from '../../services/database.service';
import { PinService } from '../../services/pin.service';
import { RowEditDialogComponent } from './row-edit-dialog.component';
import { PinDialogComponent } from './pin-dialog.component';

@Component({
  selector: 'app-data-browser',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="data-browser">
      <!-- Data Browser Content -->
      <div class="browser-content">
        <div class="browser-header">
          <div class="header-left">
            <mat-form-field appearance="outline" class="table-select">
              <mat-label>Select Table</mat-label>
              <mat-select [(ngModel)]="selectedTable" (selectionChange)="onTableChange()">
                @for (table of tables; track table) {
                <mat-option [value]="table">
                  {{ table }}
                </mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (selectedTable) {
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchQuery" (keyup.enter)="loadTableData()" placeholder="Search all columns...">
              <mat-icon matSuffix (click)="loadTableData()" style="cursor:pointer">search</mat-icon>
            </mat-form-field>
            }
          </div>

          <div class="header-right">
            <button mat-icon-button (click)="loadTableData()" matTooltip="Refresh">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </div>

        <!-- Loading Spinner -->
        @if (isLoading) {
        <div class="loading">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
        }

        <!-- Data Table -->
        @if (selectedTable && !isLoading) {
        <div class="table-container">
          <table mat-table [dataSource]="rows" class="data-table">
            @for (column of displayedColumns; track column) {
            <ng-container [matColumnDef]="column">
              <th mat-header-cell *matHeaderCellDef>{{ column }}</th>
              <td mat-cell *matCellDef="let row">
                <span class="cell-content" [title]="getCellValue(row, column)">
                  {{ getCellValue(row, column) | slice:0:50 }}{{ (getCellValue(row, column) || '').length > 50 ? '...' : '' }}
                </span>
              </td>
            </ng-container>
            }

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Actions</th>
              <td mat-cell *matCellDef="let row">
                <button mat-icon-button color="primary" (click)="editRow(row)" matTooltip="Edit">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteRow(row)" matTooltip="Delete">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="allColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: allColumns;"></tr>
          </table>

          <!-- Empty State -->
          @if (rows.length === 0) {
          <div class="empty-state">
            <mat-icon>inbox</mat-icon>
            <p>No data found</p>
          </div>
          }

          <!-- Paginator -->
          <mat-paginator
            [length]="totalRows"
            [pageSize]="pageSize"
            [pageIndex]="currentPage - 1"
            [pageSizeOptions]="[10, 20, 50, 100]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .data-browser {
      padding: 1rem;
    }

    .pin-gate {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;

      .lock-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: rgba(0, 0, 0, 0.4);
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0 0 0.5rem 0;
        color: rgba(0, 0, 0, 0.87);
      }

      p {
        margin: 0 0 1.5rem 0;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    .browser-header {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;

      .header-left {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        flex: 1;
      }

      .header-right {
        display: flex;
        gap: 0.25rem;
      }
    }

    .table-select {
      min-width: 200px;
    }

    .search-field {
      min-width: 200px;
      flex: 1;
      max-width: 300px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }

    .table-container {
      overflow-x: auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .data-table {
      width: 100%;
      min-width: 600px;

      th {
        font-weight: 600;
        background: #f5f5f5;
        white-space: nowrap;
      }

      td {
        max-width: 200px;
      }

      .cell-content {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1rem;
      color: rgba(0, 0, 0, 0.4);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 0.5rem;
      }

      p {
        margin: 0;
      }
    }

    ::ng-deep .mat-mdc-paginator {
      background: transparent;
    }
  `]
})
export class DataBrowserComponent implements OnInit {
  tables: string[] = [];
  selectedTable: string = '';
  columns: { name: string; type: string; notnull: boolean; pk: boolean }[] = [];
  rows: any[] = [];
  totalRows = 0;
  currentPage = 1;
  pageSize = 20;
  searchQuery = '';
  isLoading = false;

  get displayedColumns(): string[] {
    return this.columns.map(c => c.name);
  }

  get allColumns(): string[] {
    return [...this.displayedColumns, 'actions'];
  }

  constructor(
    private db: DatabaseService,
    private pinService: PinService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadTables();
  }

  async loadTables() {
    this.tables = await this.db.getTableNames();
  }

  async onTableChange() {
    this.currentPage = 1;
    this.searchQuery = '';
    await this.loadTableSchema();
    await this.loadTableData();
  }

  async loadTableSchema() {
    if (!this.selectedTable) return;
    this.columns = await this.db.getTableSchema(this.selectedTable);
  }

  async loadTableData() {
    if (!this.selectedTable) return;

    this.isLoading = true;
    try {
      const result = await this.db.getTableData(
        this.selectedTable,
        this.currentPage,
        this.pageSize,
        this.searchQuery
      );
      this.rows = result.rows;
      this.totalRows = result.total;
    } catch (error) {
      console.error('Error loading table data:', error);
      this.showMessage('Error loading data');
    } finally {
      this.isLoading = false;
    }
  }

  onPageChange(event: PageEvent) {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadTableData();
  }

  getCellValue(row: any, column: string): string {
    const value = row[column];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  editRow(row: any) {
    const dialogRef = this.dialog.open(RowEditDialogComponent, {
      width: '500px',
      maxHeight: '80vh',
      data: {
        tableName: this.selectedTable,
        row: { ...row },
        columns: this.columns
      }
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const success = await this.db.updateTableRow(this.selectedTable, row.id, result);
        if (success) {
          this.showMessage('Row updated successfully');
          await this.loadTableData();
        } else {
          this.showMessage('Failed to update row');
        }
      }
    });
  }

  async deleteRow(row: any) {
    if (!confirm(`Delete row with ID ${row.id}? This cannot be undone.`)) return;

    const success = await this.db.deleteTableRow(this.selectedTable, row.id);
    if (success) {
      this.showMessage('Row deleted successfully');
      await this.loadTableData();
    } else {
      this.showMessage('Failed to delete row');
    }
  }

  private showMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
