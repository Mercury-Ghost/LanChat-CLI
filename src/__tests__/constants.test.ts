// Set required environment variables before importing constants
process.env.JWT_SECRET = 'test-secret-for-jest';

import * as constants from '../shared/constants';

describe('constants', () => {
  describe('basic validation', () => {
    it('should export valid port constants', () => {
      expect(constants.SERVER_PORT).toBeGreaterThan(0);
      expect(constants.SERVER_PORT).toBeLessThanOrEqual(65535);
    });

    it('should export valid length constraints', () => {
      expect(constants.MIN_NICKNAME_LENGTH).toBeLessThan(constants.MAX_NICKNAME_LENGTH);
      expect(constants.MIN_ROOMNAME_LENGTH).toBeLessThan(constants.MAX_ROOMNAME_LENGTH);
    });

    it('should export default room name', () => {
      expect(constants.DEFAULT_ROOM_NAME).toBe('#general');
    });

    it('should export valid time constants', () => {
      expect(constants.HEARTBEAT_INTERVAL).toBeGreaterThan(0);
      expect(constants.HEARTBEAT_TIMEOUT).toBeGreaterThan(0);
      expect(constants.CONNECTION_TIMEOUT).toBeGreaterThan(0);
    });
  });
});
