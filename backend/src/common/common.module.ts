import { Module } from '@nestjs/common';
import { IPValidationService } from './services/ip-validation.service';

@Module({
  providers: [IPValidationService],
  exports: [IPValidationService],
})
export class CommonModule {}
