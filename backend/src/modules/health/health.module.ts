import { Module } from '@nestjs/common';
import { HealthController } from '@/modules/health/health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
