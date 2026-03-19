import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';

export interface User {
  id: number;
  email: string;
  hashed_password: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string): Promise<User | null> {
    const pool = this.db.getPool();
    if (!pool) return null;
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: number): Promise<User | null> {
    const pool = this.db.getPool();
    if (!pool) return null;
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(email: string, password: string): Promise<User> {
    const pool = this.db.getPool();
    if (!pool) throw new Error('Database not available');
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query<User>(
      `INSERT INTO users (email, hashed_password)
       VALUES ($1, $2)
       RETURNING *`,
      [email, hashedPassword],
    );
    return result.rows[0];
  }
}
