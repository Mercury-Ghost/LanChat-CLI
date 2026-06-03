import { Database } from '../Database';
import { DEFAULT_HISTORY_COUNT } from '../../shared/constants';

export interface Message {
    id: number;
    room_id: number;
    sender_id: number;
    content: string;
    type: string;
    timestamp: string;
}

export interface MessageWithSender extends Message {
    sender_nickname: string;
}

export class MessageRepo {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  createRoomMessage(
    roomId: number,
    senderId: number,
    content: string,
    type: string = 'chat'
  ): number {
    const stmt = this.database.prepare(
      'INSERT INTO messages (room_id, sender_id, content, type) VALUES (?, ?, ?, ?)'
    );

    const result = stmt.run(roomId, senderId, content, type);
    return result.lastInsertRowid as number;
  }

  createPrivateMessage(
    senderId: number,
    receiverId: number,
    content: string
  ): number {
    const stmt = this.database.prepare(
      'INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)'
    );

    const result = stmt.run(senderId, receiverId, content);
    return result.lastInsertRowid as number;
  }

  getRoomHistory(
    roomId: number,
    limit: number = DEFAULT_HISTORY_COUNT,
    offset: number = 0
  ): MessageWithSender[] {
    const stmt = this.database.prepare(`
            SELECT m.*, u.nickname as sender_nickname
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.room_id = ?
            ORDER BY m.timestamp DESC
            LIMIT ? OFFSET ?
        `);

    return stmt.all(roomId, limit, offset) as MessageWithSender[];
  }

  getPrivateHistory(
    userId1: number,
    userId2: number,
    limit: number = DEFAULT_HISTORY_COUNT,
    offset: number = 0
  ): Array<Message & { sender_nickname: string; receiver_nickname: string }> {
    const stmt = this.database.prepare(`
            SELECT pm.*,
                         sender.nickname as sender_nickname,
                         receiver.nickname as receiver_nickname
            FROM private_messages pm
            JOIN users sender ON pm.sender_id = sender.id
            JOIN users receiver ON pm.receiver_id = receiver.id
            WHERE (pm.sender_id = ? AND pm.receiver_id = ?)
                 OR (pm.sender_id = ? AND pm.receiver_id = ?)
            ORDER BY pm.timestamp DESC
            LIMIT ? OFFSET ?
        `);

    return stmt.all(userId1, userId2, userId2, userId1, limit, offset) as Array<
            Message & { sender_nickname: string; receiver_nickname: string }
        >;
  }

  getMessageById(id: number): Message | undefined {
    const stmt = this.database.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as Message | undefined;
  }

  deleteOldMessages(roomId: number, keepCount: number): number {
    const stmt = this.database.prepare(`
            DELETE FROM messages
            WHERE room_id = ? AND id NOT IN (
                SELECT id FROM messages
                WHERE room_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            )
        `);

    const result = stmt.run(roomId, roomId, keepCount);
    return result.changes;
  }
}
