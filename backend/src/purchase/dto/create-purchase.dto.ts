import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumberString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '10' })
  @IsNumberString()
  quantity: string;

  @ApiProperty({ example: '4.00' })
  @IsNumberString()
  unitCost: string;

  @ApiProperty({ example: '2026-01-15T14:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
