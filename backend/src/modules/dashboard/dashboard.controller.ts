import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@Controller('dashboard')
@AdminOnly()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getDashboardData() {
    return this.dashboardService.getDashboardData();
  }
}
