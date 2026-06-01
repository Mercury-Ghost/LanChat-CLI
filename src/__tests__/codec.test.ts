import { MessageCodec, CodecError } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';

describe('MessageCodec', () => {
  describe('encode and decode', () => {
    it('should encode and decode string payload correctly', () => {
      const type = MessageType.CHAT_ROOM;
      const payload = 'Hello, world!';
      
      const encoded = MessageCodec.encode(type, payload);
      const decoded = MessageCodec.decode(encoded);
      
      expect(decoded.type).toBe(type);
      expect(decoded.payload.toString()).toBe(payload);
    });

    it('should encode and decode Buffer payload correctly', () => {
      const type = MessageType.FILE_CHUNK;
      const payload = Buffer.from([0x01, 0x02, 0x03]);
      
      const encoded = MessageCodec.encode(type, payload);
      const decoded = MessageCodec.decode(encoded);
      
      expect(decoded.type).toBe(type);
      expect(decoded.payload).toEqual(payload);
    });

    it('should encode and decode JSON payload correctly', () => {
      const type = MessageType.LOGIN_REQUEST;
      const payload = { username: 'test', password: 'pass' };
      
      const encoded = MessageCodec.encodeJson(type, payload);
      const decoded = MessageCodec.decodeJson<typeof payload>(encoded);
      
      expect(decoded.type).toBe(type);
      expect(decoded.payload).toEqual(payload);
    });
  });

  describe('error handling', () => {
    it('should throw CodecError when decoding too short frame', () => {
      const shortFrame = Buffer.from([0x00]);
      expect(() => MessageCodec.decode(shortFrame)).toThrow(CodecError);
    });

    it('should throw CodecError when payload is too large', () => {
      const largePayload = Buffer.alloc(11 * 1024 * 1024); // 11MB
      expect(() => MessageCodec.encode(MessageType.CHAT_ROOM, largePayload)).toThrow(CodecError);
    });
  });

  describe('parseStream', () => {
    it('should parse multiple messages from stream', () => {
      const msg1 = MessageCodec.encode(MessageType.CHAT_ROOM, 'Message 1');
      const msg2 = MessageCodec.encode(MessageType.CHAT_PRIVATE, 'Message 2');
      const stream = Buffer.concat([msg1, msg2]);
      
      const { messages, remaining } = MessageCodec.parseStream(stream);
      
      expect(messages.length).toBe(2);
      expect(messages[0].type).toBe(MessageType.CHAT_ROOM);
      expect(messages[0].payload.toString()).toBe('Message 1');
      expect(messages[1].type).toBe(MessageType.CHAT_PRIVATE);
      expect(messages[1].payload.toString()).toBe('Message 2');
      expect(remaining.length).toBe(0);
    });

    it('should handle incomplete frame in stream', () => {
      const msg1 = MessageCodec.encode(MessageType.CHAT_ROOM, 'Message 1');
      // Create a frame header that says it needs 10 bytes, but we only provide 6
      const incomplete = Buffer.from([0x00, 0x00, 0x00, 0x0A, 0x01, 0x02]); 
      const stream = Buffer.concat([msg1, incomplete]);
      
      const { messages, remaining } = MessageCodec.parseStream(stream);
      
      expect(messages.length).toBe(1);
      expect(remaining).toEqual(incomplete);
    });
  });
});
