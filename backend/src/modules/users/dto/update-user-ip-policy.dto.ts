import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import { IsIpOrCidr } from '@/common/validators/is-ip-or-cidr.decorator';

export const NETWORK_POLICIES = ['both', 'lan', 'wan'] as const;
export const IP_ACCESS_POLICIES = ['all', 'restricted'] as const;
const MAX_ALLOWED_IPS = 1000;

export class UpdateUserIPPolicyDto {
  @IsOptional()
  @IsIn(NETWORK_POLICIES)
  networkPolicy?: (typeof NETWORK_POLICIES)[number];

  @IsOptional()
  @IsIn(IP_ACCESS_POLICIES)
  ipAccessPolicy?: (typeof IP_ACCESS_POLICIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ALLOWED_IPS)
  @IsIpOrCidr({ each: true })
  allowedIPs?: string[];
}
