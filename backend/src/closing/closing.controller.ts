import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClosingService } from './closing.service';
import { CreateClosingDto } from './dto/create-closing.dto';
import { TodayClosingQueryDto } from './dto/today-closing-query.dto';
import { ListClosingsQueryDto } from './dto/list-closings-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiBearerAuth()
@ApiTags('Closings')
@Controller('closings')
export class ClosingController {
  constructor(private readonly closingService: ClosingService) {}

  @Post()
  close(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClosingDto) {
    return this.closingService.closeToday(dto.businessId, user.userId);
  }

  @Get('today')
  findToday(@Query() query: TodayClosingQueryDto) {
    return this.closingService.findToday(query.businessId);
  }

  @Get()
  findAll(@Query() query: ListClosingsQueryDto) {
    return this.closingService.findAll(query);
  }
}
