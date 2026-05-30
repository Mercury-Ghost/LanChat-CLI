import { Database } from '../Database';

export interface Room {
  id: number;
  name: string;
  created_by: number | null;
  is_default: number;
  created_at: string;
}

export class RoomRepo {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  create(name: string, createdBy: number | null): number {
    const stmt = this.database.prepare(
      'INSERT INTO rooms (name, created_by) VALUES (?, ?)'
    );

    const result = stmt.run(name, createdBy);
    return result.lastInsertRowid as number;
  }

  findById(id: number): Room | undefined {
    const stmt = this.database.prepare('SELECT * FROM rooms WHERE id = ?');
    return stmt.get(id) as Room | undefined;
  }

  findByName(name: string): Room | undefined {
    const stmt = this.database.prepare('SELECT * FROM rooms WHERE name = ?');
    return stmt.get(name) as Room | undefined;
  }

  update(id: number, updates: Partial<Pick<Room, 'name' | 'is_default'>>): void {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.is_default !== undefined) {
      fields.push('is_default = ?');
      values.push(updates.is_default);
    }

    if (fields.length === 0) return;

    values.push(id);
    const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.database.prepare(sql);
    stmt.run(...values);
  }

  delete(name: string): void {
    const stmt = this.database.prepare('DELETE FROM rooms WHERE name = ? AND is_default = 0');
    stmt.run(name);
  }

  exists(name: string): boolean {
    const stmt = this.database.prepare(
      'SELECT 1 FROM rooms WHERE name = ?'
    );
    return stmt.get(name) !== undefined;
  }

  isDefault(id: number): boolean {
    const stmt = this.database.prepare(
      'SELECT is_default FROM rooms WHERE id = ?'
    );
    const result = stmt.get(id) as { is_default: number } | undefined;
    return result?.is_default === 1;
  }

  getAll(): Room[] {
    const stmt = this.database.prepare('SELECT * FROM rooms ORDER BY is_default DESC, name');
    return stmt.all() as Room[];
  }
}
