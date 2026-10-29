import { IsNotEmpty, IsString } from 'class-validator';

export class PlexTokenDto {
  @IsString()
  @IsNotEmpty()
  authToken: string;
}
