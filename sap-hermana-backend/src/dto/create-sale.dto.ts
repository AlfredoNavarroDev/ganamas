import { IsUUID, IsNumberString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  businessId: string;

  @IsUUID()
  productId: string;

  @IsNumberString()
  quantity: string;

  // si no se manda, el backend usa product.price como precio de venta
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @IsOptional()
  @IsIn(['efectivo', 'yape', 'plin'])
  paymentMethod?: 'efectivo' | 'yape' | 'plin';

  @IsOptional()
  @IsDateString()
  soldAt?: string;
}
