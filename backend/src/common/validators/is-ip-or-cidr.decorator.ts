import { ValidationOptions, registerDecorator } from 'class-validator';
import { IPValidationService } from '@/common/services/ip-validation.service';

const ipValidation = new IPValidationService();

export const isIpOrCidr = (value: unknown): boolean =>
  typeof value === 'string' &&
  (ipValidation.isValidIP(value) ||
    ipValidation.isValidCIDR(value) ||
    ipValidation.isValidCIDRv6(value));

export const IsIpOrCidr =
  (options?: ValidationOptions) => (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isIpOrCidr',
      target: target.constructor,
      propertyName,
      options: {
        message: `each value in ${propertyName} must be an IP address or CIDR range`,
        ...options,
      },
      validator: { validate: isIpOrCidr },
    });
