import { MessageType } from './types';

const FRAME_HEADER_SIZE = 5;
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

export class CodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodecError';
  }
}

export interface DecodedMessage {
    type: MessageType;
    payload: Buffer;
}

export class MessageCodec {
  static encode(type: MessageType, payload: Buffer | string): Buffer {
    let payloadBuffer: Buffer;

    if (typeof payload === 'string') {
      payloadBuffer = Buffer.from(payload, 'utf8');
    } else {
      payloadBuffer = payload;
    }

    if (payloadBuffer.length > MAX_PAYLOAD_SIZE) {
      throw new CodecError(`Payload too large: ${payloadBuffer.length} bytes`);
    }

    const totalLength = FRAME_HEADER_SIZE + payloadBuffer.length;
    const frame = Buffer.alloc(totalLength);

    frame.writeUInt32BE(totalLength, 0);
    frame.writeUInt8(type, 4);
    payloadBuffer.copy(frame, FRAME_HEADER_SIZE);

    return frame;
  }

  static encodeJson(type: MessageType, payload: object): Buffer {
    const jsonString = JSON.stringify(payload);
    return this.encode(type, jsonString);
  }

  static decode(frame: Buffer): DecodedMessage {
    if (frame.length < FRAME_HEADER_SIZE) {
      throw new CodecError('Frame too short');
    }

    const totalLength = frame.readUInt32BE(0);
    if (frame.length < totalLength) {
      throw new CodecError('Incomplete frame');
    }

    const type = frame.readUInt8(4) as MessageType;
    const payload = frame.subarray(FRAME_HEADER_SIZE, totalLength);

    return { type, payload };
  }

  static decodeJson<T>(frame: Buffer): { type: MessageType; payload: T } {
    const decoded = this.decode(frame);
    const jsonString = decoded.payload.toString('utf8');
    const payload = JSON.parse(jsonString) as T;
    return { type: decoded.type, payload };
  }

  static parseStream(buffer: Buffer): { messages: DecodedMessage[]; remaining: Buffer } {
    const messages: DecodedMessage[] = [];
    let currentBuffer = buffer;

    while (currentBuffer.length >= FRAME_HEADER_SIZE) {
      const totalLength = currentBuffer.readUInt32BE(0);

      if (totalLength > MAX_PAYLOAD_SIZE + FRAME_HEADER_SIZE) {
        throw new CodecError('Frame length exceeds maximum');
      }

      if (currentBuffer.length < totalLength) {
        break;
      }

      const frame = currentBuffer.subarray(0, totalLength);
      const decoded = this.decode(frame);
      messages.push(decoded);

      currentBuffer = currentBuffer.subarray(totalLength);
    }

    return { messages, remaining: currentBuffer };
  }
}
