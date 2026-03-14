import { Injectable } from '@angular/core';

export interface LogEntry {
  timestamp: Date;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  args?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ConsoleLoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 200;
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  };

  constructor() {
    this.interceptConsole();
  }

  private interceptConsole() {
    // Intercept console.log
    console.log = (...args: any[]) => {
      this.addLog('log', args);
      this.originalConsole.log.apply(console, args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.info.apply(console, args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn.apply(console, args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error.apply(console, args);
    };
  }

  private addLog(level: 'log' | 'info' | 'warn' | 'error', args: any[]) {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      args
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs].reverse(); // Most recent first
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.getLogs().slice(0, count);
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return this.logs.map(log => 
      `[${log.timestamp.toLocaleString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
  }

  filterLogs(level?: 'log' | 'info' | 'warn' | 'error', searchTerm?: string): LogEntry[] {
    let filtered = this.getLogs();

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term)
      );
    }

    return filtered;
  }
}
