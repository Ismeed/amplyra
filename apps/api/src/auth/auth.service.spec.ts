import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@amplyra/shared';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const mockPrisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    session: {
      create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
    },
  };

  const jwtService = new JwtService({});
  const configService = new ConfigService({
    JWT_ACCESS_SECRET: 'test-access-secret-1234567890',
    JWT_REFRESH_SECRET: 'test-refresh-secret-1234567890',
  });

  const authService = new AuthService(mockPrisma, jwtService, configService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new business user and issues access & refresh tokens', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(async ({ data }: any) => ({
      id: 'user-1',
      ...data,
      emailVerifiedAt: null,
    }));

    const result = await authService.register({
      email: 'Founder@Example.ng',
      password: 'Password123!',
      fullName: 'Amina Bello',
      role: UserRole.BUSINESS,
    });

    expect(result.user.email).toBe('founder@example.ng');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(mockPrisma.session.create).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email registration', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      authService.register({
        email: 'founder@example.ng',
        password: 'Password123!',
        fullName: 'Amina Bello',
        role: UserRole.BUSINESS,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid password on login', async () => {
    const passwordHash = await bcrypt.hash('CorrectPassword123!', 10);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'founder@example.ng',
      passwordHash,
      role: UserRole.BUSINESS,
      fullName: 'Amina Bello',
    });

    await expect(
      authService.login({
        email: 'founder@example.ng',
        password: 'WrongPassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
