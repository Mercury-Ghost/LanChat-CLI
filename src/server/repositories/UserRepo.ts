import { Database } from '../Database';

export interface User {
  id: number;
  nickname: string;
  password: string;
  created_at: string;
}

export class UserRepo {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  create(nickname: string, hashedPassword: string): number {
    const stmt = this.database.prepare(
      'INSERT INTO users (nickname, password) VALUES (?, ?)'
    );

    const result = stmt.run(nickname, hashedPassword);
    return result.lastInsertRowid as number;
  }

  findById(id: number): User | undefined {
    const stmt = this.database.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  findByNickname(nickname: string): User | undefined {
    const stmt = this.database.prepare('SELECT * FROM users WHERE nickname = ?');
    return stmt.get(nickname) as User | undefined;
  }

  updatePassword(id: number, hashedPassword: string): void {
    const stmt = this.database.prepare('UPDATE users SET password = ? WHERE id = ?');
    stmt.run(hashedPassword, id);
  }

  delete(id: number): void {
    const stmt = this.database.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
  }

  exists(nickname: string): boolean {
    const stmt = this.database.prepare(
      'SELECT 1 FROM users WHERE nickname = ?'
    );
    return stmt.get(nickname) !== undefined;
  }

  getAll(): User[] {
    const stmt = this.database.prepare('SELECT * FROM users');
    return stmt.all() as User[];
  }
}
