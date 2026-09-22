import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, Length, IsNumberString, IsIn, IsOptional } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 'Palta hass madura' })
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiProperty({ example: '5.00' })
  @IsNumberString()
  price: string;

  @ApiProperty({ enum: ['unidad', 'kg'], example: 'kg' })
  @IsIn(['unidad', 'kg'])
  unit: 'unidad' | 'kg';

  @ApiProperty({ example: 'palta', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;
}
