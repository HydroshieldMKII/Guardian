import { applyDecorators } from '@nestjs/common';
import { IsDefined, ValidateBy } from 'class-validator';

const isScalarValue = (value: unknown): boolean =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

export const SettingValueField = () =>
  applyDecorators(
    IsDefined({ message: 'value is required' }),
    ValidateBy({
      name: 'isScalarSettingValue',
      validator: {
        validate: isScalarValue,
        defaultMessage: () => 'value must be a string, number or boolean',
      },
    }),
  );
