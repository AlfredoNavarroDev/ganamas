import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumberString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';

export class CreateSaleDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '2' })
  @IsNumberString()
  quantity: string;

  @ApiProperty({ example: '4.50', required: false, description: 'Omit to use the catalog price' })
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @ApiProperty({ enum: ['efectivo', 'yape', 'plin'], example: 'efectivo', required: false })
  @IsOptional()
  @IsIn(['efectivo', 'yape', 'plin'])
  paymentMethod?: 'efectivo' | 'yape' | 'plin';

  @ApiProperty({ example: '2026-01-15T19:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  soldAt?: string;
}
