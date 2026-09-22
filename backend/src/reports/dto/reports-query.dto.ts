import { IsDateString, IsUUID } from 'class-validator';

export class ReportsQueryDto {
  @IsUUID()
  businessId: string;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
