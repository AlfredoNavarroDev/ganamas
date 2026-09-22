import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';

export class ListProductsQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}
