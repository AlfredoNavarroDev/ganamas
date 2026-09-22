import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly-summary')
  weeklySummary(@Query() query: ReportsQueryDto) {
    return this.reportsService.weeklySummary(query.businessId, query.from, query.to);
  }

  @Get('kpis')
  kpis(@Query() query: ReportsQueryDto) {
    return this.reportsService.kpis(query.businessId, query.from, query.to);
  }
}
