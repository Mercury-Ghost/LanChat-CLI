import {
  validateNickname,
  validateRoomName,
  validateMessage,
  validatePassword,
  validatePort,
  validateEmail,
  validateFileSize,
  validateFileExtension,
  validatePasswordStrength,
  validateToken,
  validateIpAddress
} from '../shared/validators';

describe('validators', () => {
  describe('validateNickname', () => {
    it('should validate a correct nickname', () => {
      const result = validateNickname('testuser');
      expect(result.valid).toBe(true);
    });

    it('should reject empty nickname', () => {
      const result = validateNickname('');
      expect(result.valid).toBe(false);
    });

    it('should reject nickname shorter than 3 characters', () => {
      const result = validateNickname('ab');
      expect(result.valid).toBe(false);
    });

    it('should reject nickname with invalid characters', () => {
      const result = validateNickname('test!user');
      expect(result.valid).toBe(false);
    });

    it('should reject nickname starting with a number', () => {
      const result = validateNickname('123test');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateRoomName', () => {
    it('should validate a correct room name', () => {
      const result = validateRoomName('#general');
      expect(result.valid).toBe(true);
    });

    it('should reject room name not starting with #', () => {
      const result = validateRoomName('general');
      expect(result.valid).toBe(false);
    });

    it('should reject empty room name', () => {
      const result = validateRoomName('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMessage', () => {
    it('should validate a correct message', () => {
      const result = validateMessage('Hello, world!');
      expect(result.valid).toBe(true);
    });

    it('should reject empty message', () => {
      const result = validateMessage('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate a correct password', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(true);
    });

    it('should reject password shorter than 6 characters', () => {
      const result = validatePassword('12345');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePort', () => {
    it('should validate a correct port number', () => {
      const result = validatePort(8080);
      expect(result.valid).toBe(true);
    });

    it('should reject port number out of range', () => {
      const result = validatePort(99999);
      expect(result.valid).toBe(false);
    });

    it('should reject port 0', () => {
      const result = validatePort(0);
      expect(result.valid).toBe(false);
    });

    it('should validate port as string', () => {
      const result = validatePort('3000');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should validate a correct email', () => {
      const result = validateEmail('test@example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should validate a file size within limit', () => {
      const result = validateFileSize(1024, 2048);
      expect(result.valid).toBe(true);
    });

    it('should reject file size exceeding limit', () => {
      const result = validateFileSize(3000, 2048);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileExtension', () => {
    it('should validate allowed file extension', () => {
      const result = validateFileExtension('test.txt', ['txt', 'md']);
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed file extension', () => {
      const result = validateFileExtension('test.exe', ['txt', 'md']);
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('StrongP@ss1');
      expect(result.valid).toBe(true);
    });

    it('should reject weak password without uppercase', () => {
      const result = validatePasswordStrength('weakpass1');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should validate a simple JWT-like token format', () => {
      const result = validateToken('header.payload.signature');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid token format', () => {
      const result = validateToken('invalid-token');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateIpAddress', () => {
    it('should validate a correct IPv4 address', () => {
      const result = validateIpAddress('192.168.1.1');
      expect(result.valid).toBe(true);
    });

    it('should validate a correct IPv6 address', () => {
      const result = validateIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid IP address', () => {
      const result = validateIpAddress('999.999.999.999');
      expect(result.valid).toBe(false);
    });
  });
});
