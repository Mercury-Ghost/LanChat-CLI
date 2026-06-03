import DatabaseModule from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DB_PATH, DEFAULT_ROOM_NAME } from '../shared/constants';

class DatabaseConnection {
  public db: DatabaseModule.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ? path.resolve(dbPath) : path.resolve(DB_PATH);

    const dbDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseModule(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  prepare(sql: string): DatabaseModule.Statement {
    return this.db.prepare(sql);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}

class Database {
  private connections: DatabaseConnection[] = [];
  private connectionIndex = 0;
  private readonly poolSize: number;

  constructor(poolSize: number = 5) {
    this.poolSize = poolSize;
    this.initPool();
  }

  private initPool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const connection = new DatabaseConnection();
      this.connections.push(connection);
    }
  }

  private getConnection(): DatabaseConnection {
    this.connectionIndex = (this.connectionIndex + 1) % this.connections.length;
    return this.connections[this.connectionIndex];
  }

  public init(): void {
    const connection = this.getConnection();
    this.createTables(connection);
    this.createIndexes(connection);
    this.seedDefaultData(connection);
  }

  private createTables(connection: DatabaseConnection): void {
    const sql = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_by INTEGER REFERENCES users(id),
                is_default INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER REFERENCES rooms(id) NOT NULL,
                sender_id INTEGER REFERENCES users(id) NOT NULL,
                content TEXT NOT NULL,
                type TEXT DEFAULT 'chat',
                timestamp TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS private_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER REFERENCES users(id) NOT NULL,
                receiver_id INTEGER REFERENCES users(id) NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_id TEXT UNIQUE NOT NULL,
                sender_id INTEGER REFERENCES users(id),
                receiver_id INTEGER,
                room_id INTEGER REFERENCES rooms(id),
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                stored_path TEXT,
                timestamp TEXT DEFAULT (datetime('now'))
            );
        `;

    connection.exec(sql);
  }

  private createIndexes(connection: DatabaseConnection): void {
    const indexes = `
            CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages (room_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_private_messages_users_time ON private_messages (sender_id, receiver_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);
        `;

    connection.exec(indexes);
  }

  private seedDefaultData(connection: DatabaseConnection): void {
    const checkRoom = connection.prepare(
      'SELECT id FROM rooms WHERE name = ?'
    );

    const existingRoom = checkRoom.get(DEFAULT_ROOM_NAME);

    if (!existingRoom) {
      const insertRoom = connection.prepare(
        'INSERT INTO rooms (name, is_default) VALUES (?, 1)'
      );
      insertRoom.run(DEFAULT_ROOM_NAME);
    }
  }

  prepare(sql: string): DatabaseModule.Statement {
    return this.getConnection().prepare(sql);
  }

  transaction<T>(fn: () => T): T {
    const connection = this.getConnection();
    const tx = connection.transaction(fn) as () => T;
    return tx();
  }

  close(): void {
    for (const connection of this.connections) {
      connection.close();
    }
  }
}

export { Database };
export default Database;