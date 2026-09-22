import { IsUUID, IsString, Length, IsNumberString, IsIn, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  businessId: string;

  @IsString()
  @Length(1, 150)
  name: string;

  @IsNumberString()
  price: string;

  @IsIn(['unidad', 'kg'])
  unit: 'unidad' | 'kg';

  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;
}
