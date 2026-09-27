import { IsUUID } from 'class-validator';

export class CreateClosingDto {
  @IsUUID()
  businessId: string;
}
