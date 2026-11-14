import {
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { VerificationService } from './verification.service';

@Controller('cron')
export class VerificationCronController {
  constructor(
    private readonly configService: ConfigService,
    private readonly verificationService: VerificationService,
  ) {}

  @Get('agentic-sync')
  async handleCronGet(@Headers('authorization') authHeader?: string) {
    this.assertCronAuthorized(authHeader);
    return this.verificationService.runAgenticSync({ staleHours: 4, limit: 25 });
  }

  @Post('agentic-sync')
  async handleCronPost(@Headers('authorization') authHeader?: string) {
    this.assertCronAuthorized(authHeader);
    return this.verificationService.runAgenticSync({ staleHours: 4, limit: 25 });
  }

  private assertCronAuthorized(authHeader?: string) {
    const secret = this.configService.get<string>('CRON_SECRET')?.trim();
    if (!secret) {
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('CRON_SECRET not configured');
      }
      return;
    }

    const expected = `Bearer ${secret}`;
    const provided = authHeader ?? '';
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid cron authorization');
    }
  }
}
