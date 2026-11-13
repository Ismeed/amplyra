import { Global, Module } from '@nestjs/common';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Global()
@Module({
  controllers: [SocialController],
  providers: [SocialService, TokenCryptoService],
  exports: [SocialService, TokenCryptoService],
})
export class SocialModule {}
