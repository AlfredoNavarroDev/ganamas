import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DayClosing } from '../entities/day-closing.entity';
import { ClosingController } from './closing.controller';
import { ClosingService } from './closing.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [TypeOrmModule.forFeature([DayClosing]), ReportsModule],
  controllers: [ClosingController],
  providers: [ClosingService],
})
export class ClosingModule {}
