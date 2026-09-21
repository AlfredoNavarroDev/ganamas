import { IsUUID, IsNumberString, IsOptional, IsDateString } from 'class-validator';

export class CreatePurchaseDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsNumberString()
  quantity: string;

  @IsNumberString()
  unitCost: string;

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
