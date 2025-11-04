import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
