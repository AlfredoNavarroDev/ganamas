import { IsUUID } from 'class-validator';

export class TodayClosingQueryDto {
  @IsUUID()
  businessId: string;
}
