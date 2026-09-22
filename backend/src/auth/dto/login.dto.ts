import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'hermana' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'super-secret' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
