import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface LogEntry {
  timestamp: Date;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  args?: unknown[];
}

// Dev-only console buffer. In production it is a no-op: console.* is NOT
// patched, no logs are retained, and the admin viewer (removed in Phase 3)
// no longer ships. Resolves audit findings H15 / M12 / M13.
@Injectable({ providedIn: 'root' })
export class ConsoleLoggerService {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 200;
  private readonly enabled = !environment.production;

  constructor() {
    if (this.enabled) {
      this.interceptConsole();
    }
  }

  private interceptConsole() {
    const original = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
      console[level] = (...args: unknown[]) => {
        this.addLog(level, args);
        original[level](...args);
      };
    });
  }

  private addLog(level: LogEntry['level'], args: unknown[]) {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    this.logs.push({ timestamp: new Date(), level, message, args });
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  getLogs(): LogEntry[] {
    return this.enabled ? [...this.logs].reverse() : [];
  }

  getRecentLogs(count = 100): LogEntry[] {
    return this.getLogs().slice(0, count);
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return this.logs
      .map(
        (l) =>
          `[${l.timestamp.toLocaleString()}] [${l.level.toUpperCase()}] ${l.message}`,
      )
      .join('\n');
  }

  filterLogs(level?: LogEntry['level'], searchTerm?: string): LogEntry[] {
    let out = this.getLogs();
    if (level) out = out.filter((l) => l.level === level);
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      out = out.filter((l) => l.message.toLowerCase().includes(t));
    }
    return out;
  }
}
