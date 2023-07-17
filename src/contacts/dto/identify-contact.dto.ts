import { IsEmail, IsOptional } from 'class-validator';

export class IdentifyContactDto {
  @IsOptional()
  @IsEmail()
  'email'?: string;

  @IsOptional()
  'phoneNumber'?: string;
}
