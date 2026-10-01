import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty } from 'class-validator';

function trimIfString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class LoginDto {
  @ApiProperty({ example: 'hermana' })
  @Transform(trimIfString)
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'super-secret' })
  @Transform(trimIfString)
  @IsString()
  @IsNotEmpty()
  password: string;
}
