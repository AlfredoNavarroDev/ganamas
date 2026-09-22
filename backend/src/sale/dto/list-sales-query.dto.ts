import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListSalesQueryDto extends PaginationQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
