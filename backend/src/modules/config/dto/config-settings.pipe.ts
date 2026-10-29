import { ParseArrayPipe } from '@nestjs/common';
import { ConfigSettingDto } from '@/modules/config/dto/config-setting.dto';

export const configSettingsPipe = new ParseArrayPipe({
  items: ConfigSettingDto,
  whitelist: true,
  forbidNonWhitelisted: true,
});
