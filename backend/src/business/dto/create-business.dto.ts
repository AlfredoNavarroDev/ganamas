import { IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @Length(1, 100)
  name: string;
}
