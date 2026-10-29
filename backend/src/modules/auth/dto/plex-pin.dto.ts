import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PlexPinDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  clientId: string;
}
