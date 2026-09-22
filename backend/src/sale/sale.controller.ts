import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

@ApiBearerAuth()
@ApiTags('Sales')
@Controller('sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.saleService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListSalesQueryDto) {
    return this.saleService.findAll(query);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.saleService.remove(id);
  }
}
