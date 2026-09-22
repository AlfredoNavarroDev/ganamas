import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Frutas' })
  @IsString()
  @Length(1, 100)
  name: string;
}
