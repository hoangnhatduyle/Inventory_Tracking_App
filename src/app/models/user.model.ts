export interface User {
  id?: number;
  username: string;
  password: string;
  email?: string;
  createdAt?: string;
}

export interface Session {
  id?: number;
  userId: number;
  token: string;
  expiresAt: string;
  createdAt?: string;
}
