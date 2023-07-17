import { IsArray, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class IdentifyContactResponseDto {
  @IsNumber()
  primaryContatctId: number;

  @IsArray()
  @IsString({ each: true })
  emails: string[];

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers: string[];

  @IsNotEmpty()
  @IsArray()
  @IsNumber({}, { each: true })
  secondaryContactIds: number[];
}
