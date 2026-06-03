import { Database } from '../Database';

export interface FileRecord {
    id: number;
    transfer_id: string;
    sender_id: number | null;
    receiver_id: number | null;
    room_id: number | null;
    file_name: string;
    file_size: number;
    stored_path: string | null;
    timestamp: string;
}

export interface CreateFileRecord {
    transferId: string;
    senderId: number;
    receiverId?: number | null;
    roomId?: number | null;
    fileName: string;
    fileSize: number;
    storedPath?: string;
}

export class FileRepo {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  create(record: CreateFileRecord): number {
    const stmt = this.database.prepare(`
            INSERT INTO files (transfer_id, sender_id, receiver_id, room_id, file_name, file_size, stored_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

    const result = stmt.run(
      record.transferId,
      record.senderId,
      record.receiverId ?? null,
      record.roomId ?? null,
      record.fileName,
      record.fileSize,
      record.storedPath ?? null
    );

    return result.lastInsertRowid as number;
  }

  findByTransferId(transferId: string): FileRecord | undefined {
    const stmt = this.database.prepare('SELECT * FROM files WHERE transfer_id = ?');
    return stmt.get(transferId) as FileRecord | undefined;
  }

  updateStoredPath(transferId: string, storedPath: string): void {
    const stmt = this.database.prepare(
      'UPDATE files SET stored_path = ? WHERE transfer_id = ?'
    );
    stmt.run(storedPath, transferId);
  }

  getUserFiles(userId: number, limit: number = 50): FileRecord[] {
    const stmt = this.database.prepare(`
            SELECT * FROM files
            WHERE sender_id = ? OR receiver_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);

    return stmt.all(userId, userId, limit) as FileRecord[];
  }

  getRoomFiles(roomId: number, limit: number = 50): FileRecord[] {
    const stmt = this.database.prepare(`
            SELECT * FROM files
            WHERE room_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);

    return stmt.all(roomId, limit) as FileRecord[];
  }

  delete(transferId: string): void {
    const stmt = this.database.prepare('DELETE FROM files WHERE transfer_id = ?');
    stmt.run(transferId);
  }

  getAll(limit: number = 100): FileRecord[] {
    const stmt = this.database.prepare(`
            SELECT * FROM files
            ORDER BY timestamp DESC
            LIMIT ?
        `);

    return stmt.all(limit) as FileRecord[];
  }
}
