import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ListClosingsQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
