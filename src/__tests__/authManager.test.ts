import { AuthError } from '../shared/errors';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
}));

jest.mock('../server/Database');
jest.mock('../server/repositories/UserRepo', () => ({
  UserRepo: jest.fn().mockImplementation(() => ({
    findByNickname: jest.fn().mockReturnValue(null),
    create: jest.fn(),
    findById: jest.fn().mockReturnValue({ id: 1, nickname: 'testuser', password: 'hashed' }),
    updatePassword: jest.fn(),
  })),
}));

describe('AuthManager', () => {
  describe('register', () => {
    it('should reject when nickname already exists', async () => {
      const { AuthManager } = await import('../server/AuthManager');
      const { Database } = await import('../server/Database');
      const { UserRepo } = await import('../server/repositories/UserRepo');
      
      const mockDatabase = new (Database as any)();
      const mockUserRepo = new (UserRepo as any)();
      mockUserRepo.findByNickname = jest.fn().mockReturnValue({ id: 1, nickname: 'existing', password: 'hashed' });
      
      const authManager = new (AuthManager as any)(mockDatabase);
      authManager.userRepo = mockUserRepo;

      await expect(authManager.register({ nickname: 'existing', password: 'StrongP@ss1' }))
        .rejects
        .toThrow(AuthError);
    });

    it('should create user when nickname is available', async () => {
      const { AuthManager } = await import('../server/AuthManager');
      const { Database } = await import('../server/Database');
      const { UserRepo } = await import('../server/repositories/UserRepo');
      
      const mockDatabase = new (Database as any)();
      const mockUserRepo = new (UserRepo as any)();
      mockUserRepo.findByNickname = jest.fn().mockReturnValue(null);
      mockUserRepo.create = jest.fn();
      
      const authManager = new (AuthManager as any)(mockDatabase);
      authManager.userRepo = mockUserRepo;

      await authManager.register({ nickname: 'newuser', password: 'StrongP@ss1' });
      
      expect(mockUserRepo.create).toHaveBeenCalledWith('newuser', 'hashed-password');
    });
  });
});
