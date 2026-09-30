import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumberString,
  IsString,
  Length,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: '25.00' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ example: 'Bolsas para empacar' })
  @IsString()
  @Length(1, 255)
  description: string;

  @ApiProperty({ example: '2026-09-29T14:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  expensedAt?: string;
}
