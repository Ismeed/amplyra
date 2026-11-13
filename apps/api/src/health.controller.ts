import { Controller, Get, Optional } from '@nestjs/common';
import { StorageService } from './storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(@Optional() private readonly storageService?: StorageService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'amplyra-api',
      storage: this.storageService?.getStatus() ?? {
        provider: 'supabase-storage',
        configured: false,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
