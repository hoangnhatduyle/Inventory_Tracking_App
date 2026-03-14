import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConsoleLoggerService, LogEntry } from '../../services/console-logger.service';
import { toLocalDateString } from '../../utils/date.utils';

@Component({
  selector: 'app-console-viewer',
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
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="console-viewer">
      <!-- Controls -->
      <div class="controls">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search logs</mat-label>
          <input matInput [(ngModel)]="searchTerm" (input)="filterLogs()" placeholder="Search...">
          <mat-icon matPrefix>search</mat-icon>
          @if (searchTerm) {
          <button mat-icon-button matSuffix (click)="searchTerm = ''; filterLogs()">
            <mat-icon>close</mat-icon>
          </button>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="level-select">
          <mat-label>Level</mat-label>
          <mat-select [(ngModel)]="selectedLevel" (selectionChange)="filterLogs()">
            <mat-option [value]="null">All Levels</mat-option>
            <mat-option value="log">Log</mat-option>
            <mat-option value="info">Info</mat-option>
            <mat-option value="warn">Warning</mat-option>
            <mat-option value="error">Error</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-raised-button (click)="refreshLogs()" matTooltip="Refresh">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>

        <button mat-raised-button (click)="exportLogs()" matTooltip="Export logs">
          <mat-icon>download</mat-icon>
          Export
        </button>

        <button mat-raised-button color="warn" (click)="clearLogs()" matTooltip="Clear all logs">
          <mat-icon>delete_sweep</mat-icon>
          Clear
        </button>
      </div>

      <!-- Stats -->
      <div class="stats-chips">
        <mat-chip-set>
          <mat-chip>
            <mat-icon>info</mat-icon>
            {{ filteredLogs.length }} / {{ totalLogs }} logs
          </mat-chip>
          <mat-chip class="error-chip" *ngIf="errorCount > 0">
            <mat-icon>error</mat-icon>
            {{ errorCount }} errors
          </mat-chip>
          <mat-chip class="warn-chip" *ngIf="warnCount > 0">
            <mat-icon>warning</mat-icon>
            {{ warnCount }} warnings
          </mat-chip>
        </mat-chip-set>
      </div>

      <!-- Log entries -->
      <div class="log-container">
        @if (filteredLogs.length === 0) {
        <div class="empty-state">
          <mat-icon>article</mat-icon>
          <p>No logs to display</p>
          <p class="hint">Console logs will appear here as they are generated</p>
        </div>
        }

        @for (log of filteredLogs; track $index) {
        <div class="log-entry" [class]="'log-' + log.level">
          <div class="log-header">
            <mat-icon class="log-icon">{{ getLogIcon(log.level) }}</mat-icon>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          </div>
          <div class="log-message">{{ log.message }}</div>
        </div>
        }
      </div>

      <!-- Auto-scroll toggle -->
      <div class="footer-controls">
        <label class="auto-scroll-toggle">
          <input type="checkbox" [(ngModel)]="autoScroll">
          <span>Auto-scroll to bottom</span>
        </label>
      </div>
    </div>
  `,
  styles: [`
    .console-viewer {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    .controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-field {
      flex: 1;
      min-width: 200px;
    }

    .level-select {
      width: 150px;
    }

    .stats-chips {
      mat-chip-set {
        display: flex;
        flex-wrap: wrap;
      }

      mat-chip {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .error-chip {
        background-color: #f44336 !important;
        color: white !important;
      }

      .warn-chip {
        background-color: #ff9800 !important;
        color: white !important;
      }
    }

    .log-container {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: #1e1e1e;
      padding: 0.5rem;
      max-height: 500px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      color: #999;
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 1rem;
      }

      .hint {
        font-size: 0.875rem;
        margin-top: 0.5rem;
      }
    }

    .log-entry {
      margin-bottom: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      border-left: 3px solid;
      background: #2d2d2d;
    }

    .log-log {
      border-left-color: #4caf50;
      color: #e0e0e0;
    }

    .log-info {
      border-left-color: #2196f3;
      color: #90caf9;
    }

    .log-warn {
      border-left-color: #ff9800;
      color: #ffb74d;
      background: #3a2f1e;
    }

    .log-error {
      border-left-color: #f44336;
      color: #ef5350;
      background: #3a1e1e;
    }

    .log-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
      font-size: 11px;
    }

    .log-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .log-level {
      font-weight: bold;
      min-width: 50px;
    }

    .log-time {
      color: #888;
      font-size: 10px;
    }

    .log-message {
      padding-left: 1.5rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .footer-controls {
      display: flex;
      justify-content: flex-end;
      padding: 0.5rem 0;
    }

    .auto-scroll-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      font-size: 14px;

      input[type="checkbox"] {
        cursor: pointer;
      }
    }
  `]
})
export class ConsoleViewerComponent implements OnInit, OnDestroy {
  filteredLogs: LogEntry[] = [];
  totalLogs = 0;
  errorCount = 0;
  warnCount = 0;
  searchTerm = '';
  selectedLevel: 'log' | 'info' | 'warn' | 'error' | null = null;
  autoScroll = true;
  private refreshInterval: any;

  constructor(
    private loggerService: ConsoleLoggerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.refreshLogs();
    
    // Auto-refresh every 2 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshLogs();
    }, 2000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  refreshLogs() {
    this.filterLogs();
    this.updateStats();

    if (this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  filterLogs() {
    this.filteredLogs = this.loggerService.filterLogs(
      this.selectedLevel || undefined,
      this.searchTerm || undefined
    );
  }

  updateStats() {
    const allLogs = this.loggerService.getLogs();
    this.totalLogs = allLogs.length;
    this.errorCount = allLogs.filter(log => log.level === 'error').length;
    this.warnCount = allLogs.filter(log => log.level === 'warn').length;
  }

  clearLogs() {
    if (confirm('Clear all console logs?')) {
      this.loggerService.clearLogs();
      this.refreshLogs();
      this.snackBar.open('Logs cleared', 'Close', { duration: 2000 });
    }
  }

  exportLogs() {
    const content = this.loggerService.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${toLocalDateString(new Date())}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.snackBar.open('Logs exported', 'Close', { duration: 2000 });
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getLogIcon(level: string): string {
    switch (level) {
      case 'error': return 'error';
      case 'warn': return 'warning';
      case 'info': return 'info';
      default: return 'article';
    }
  }

  private scrollToBottom() {
    const container = document.querySelector('.log-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
