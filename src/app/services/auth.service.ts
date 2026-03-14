import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DatabaseService } from './database.service';
import { User, Session } from '../models/user.model';
import * as CryptoJS from 'crypto-js';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly SESSION_KEY = 'inventory_session';
  private readonly SESSION_DURATION_DAYS = 30;
  private currentUser: User | null = null;
  private authStateSubject = new BehaviorSubject<boolean>(false);
  public authState$: Observable<boolean> = this.authStateSubject.asObservable();

  constructor(private db: DatabaseService, private router: Router) {}

  async register(username: string, password: string, email?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Check if username already exists
      const checkQuery = `SELECT COUNT(*) as count FROM users WHERE username = ?`;
      const result = await this.db.query(checkQuery, [username]);

      if (result.values && result.values[0].count > 0) {
        return { success: false, message: 'Username already exists' };
      }

      // Hash password
      const hashedPassword = this.hashPassword(password);

      // Insert new user
      const insertQuery = `INSERT INTO users (username, password, email) VALUES (?, ?, ?)`;
      await this.db.run(insertQuery, [username, hashedPassword, email || null]);

      return { success: true, message: 'Registration successful' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Registration failed' };
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find user by username
      const query = `SELECT * FROM users WHERE username = ?`;
      const result = await this.db.query(query, [username]);

      if (!result.values || result.values.length === 0) {
        return { success: false, message: 'Invalid username or password' };
      }

      const user = result.values[0];

      // Verify password (handles both salted and legacy unsalted hashes)
      if (!this.verifyPassword(password, user.password)) {
        return { success: false, message: 'Invalid username or password' };
      }

      // Automatic migration: if legacy hash, re-hash with salt and update
      if (!user.password.includes(':')) {
        const newHash = this.hashPassword(password);
        await this.db.run(`UPDATE users SET password = ? WHERE id = ?`, [newHash, user.id]);
        user.password = newHash;
      }

      this.currentUser = {
        id: user.id,
        username: user.username,
        password: user.password,
        email: user.email,
        createdAt: user.created_at
      };
      // Clear password from memory — don't expose hash to components
      this.currentUser.password = '';

      // Create session
      await this.createSession(user.id);
      this.authStateSubject.next(true);

      return { success: true, message: 'Login successful' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.currentUser && this.currentUser.id) {
        // Delete session from database
        const deleteQuery = `DELETE FROM sessions WHERE user_id = ?`;
        await this.db.run(deleteQuery, [this.currentUser.id]);
      }

      // Clear local session
      localStorage.removeItem(this.SESSION_KEY);
      this.currentUser = null;
      this.authStateSubject.next(false);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      
      if (!sessionData) {
        return false;
      }

      const session: Session = JSON.parse(sessionData);
      
      // Check if session is expired
      const expiresAt = new Date(session.expiresAt);
      const now = new Date();

      if (now > expiresAt) {
        await this.logout();
        return false;
      }

      // Verify session in database
      const query = `SELECT * FROM sessions WHERE token = ? AND user_id = ?`;
      const result = await this.db.query(query, [session.token, session.userId]);

      if (!result.values || result.values.length === 0) {
        await this.logout();
        return false;
      }

      // Load current user if not loaded
      if (!this.currentUser) {
        await this.loadCurrentUser(session.userId);
      }

      this.authStateSubject.next(true);
      return true;
    } catch (error) {
      console.error('Authentication check error:', error);
      this.authStateSubject.next(false);
      return false;
    }
  }

  private async createSession(userId: number): Promise<void> {
    try {
      // Generate session token
      const token = this.generateToken();
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.SESSION_DURATION_DAYS);

      // Delete old sessions for this user
      const deleteQuery = `DELETE FROM sessions WHERE user_id = ?`;
      await this.db.run(deleteQuery, [userId]);

      // Insert new session
      const insertQuery = `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`;
      await this.db.run(insertQuery, [userId, token, expiresAt.toISOString()]);

      // Store session in local storage
      const session: Session = {
        userId,
        token,
        expiresAt: expiresAt.toISOString()
      };

      localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  }

  private async loadCurrentUser(userId: number): Promise<void> {
    try {
      const query = `SELECT * FROM users WHERE id = ?`;
      const result = await this.db.query(query, [userId]);

      if (result.values && result.values.length > 0) {
        const user = result.values[0];
        this.currentUser = {
          id: user.id,
          username: user.username,
          password: user.password,
          email: user.email,
          createdAt: user.created_at
        };
        // Clear password from memory — don't expose hash to components
        this.currentUser.password = '';
      }
    } catch (error) {
      console.error('Load user error:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (sessionData) {
      const session: Session = JSON.parse(sessionData);
      await this.loadCurrentUser(session.userId);
      return this.currentUser;
    }

    return null;
  }

  async getCurrentUserId(): Promise<number | null> {
    if (this.currentUser && this.currentUser.id) {
      return this.currentUser.id;
    }

    const sessionData = localStorage.getItem(this.SESSION_KEY);
    if (sessionData) {
      const session: Session = JSON.parse(sessionData);

      // Validate token against database
      const tokenResult = await this.db.query(
        `SELECT * FROM sessions WHERE token = ? AND user_id = ?`,
        [session.token, session.userId]
      );

      if (!tokenResult.values || tokenResult.values.length === 0) {
        // Token is invalid or expired
        localStorage.removeItem(this.SESSION_KEY);
        return null;
      }

      // Check session expiry
      const expiresAt = new Date(session.expiresAt);
      if (new Date() > expiresAt) {
        localStorage.removeItem(this.SESSION_KEY);
        return null;
      }

      await this.loadCurrentUser(session.userId);
      return this.currentUser ? this.currentUser.id! : null;
    }

    return null;
  }

  // Alias for getCurrentUserId for convenience
  async getUserId(): Promise<number | null> {
    return this.getCurrentUserId();
  }

  private hashPassword(password: string, salt?: string): string {
    const s = salt ?? CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.SHA256(s + password).toString();
    return `${s}:${hash}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const parts = stored.split(':');
    if (parts.length === 2) {
      // New format: "salt:hash"
      const [salt, _hash] = parts;
      return this.hashPassword(password, salt) === stored;
    } else {
      // Legacy format: plain SHA256 hash (no salt)
      // Support old hashes for backward compatibility
      const plainHash = CryptoJS.SHA256(password).toString();
      return plainHash === stored;
    }
  }

  private generateToken(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }
}
