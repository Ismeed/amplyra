import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserRole } from '@amplyra/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const emailVerifyToken = randomBytes(24).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: dto.role,
        emailVerifyToken,
      },
    });

    const tokens = await this.issueSessionTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      ...tokens,
      verificationToken: emailVerifyToken,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        business: { select: { id: true, name: true } },
        creator: { select: { id: true, displayName: true } },
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueSessionTokens({
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      fullName: user.fullName,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
        business: user.business,
        creator: user.creator,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'dev-amplyra-refresh-secret-do-not-use-in-prod';

    let payload: { sub: string; sessionId: string };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      !(await bcrypt.compare(refreshToken, session.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Session is invalid or revoked');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueSessionTokens({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role as UserRole,
      fullName: session.user.fullName,
    });

    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'dev-amplyra-refresh-secret-do-not-use-in-prod';
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: string;
          sessionId: string;
        }>(refreshToken, { secret: refreshSecret });
        if (payload.sub === userId) {
          await this.prisma.session.updateMany({
            where: { id: payload.sessionId, userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          return { loggedOut: true };
        }
      } catch {
        // Fall through to revoke all active sessions for safety.
      }
    }

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
      },
    });

    return {
      verified: true,
      email: updated.email,
      emailVerifiedAt: updated.emailVerifiedAt,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        business: true,
        creator: {
          include: {
            socialAccounts: true,
            portfolioItems: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async issueSessionTokens(user: {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
  }) {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'dev-amplyra-access-secret-do-not-use-in-prod';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'dev-amplyra-refresh-secret-do-not-use-in-prod';

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const sessionId = randomBytes(12).toString('hex');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: this.configService.get<string>('JWT_ACCESS_TTL') || '15m',
      }),
      this.jwtService.signAsync(
        { sub: user.id, sessionId },
        {
          secret: refreshSecret,
          expiresIn: this.configService.get<string>('JWT_REFRESH_TTL') || '7d',
        },
      ),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
