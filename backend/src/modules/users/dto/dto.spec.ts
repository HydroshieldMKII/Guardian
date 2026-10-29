import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BatchTimeRulesDto } from '@/modules/users/dto/batch-time-rules.dto';
import { CreateTimeRuleBodyDto } from '@/modules/users/dto/create-time-rule.dto';
import { TimeRulePresetBodyDto } from '@/modules/users/dto/time-rule-preset.dto';
import { UpdateTimeRuleBodyDto } from '@/modules/users/dto/update-time-rule.dto';

const propertiesFor = <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) => validateSync(plainToInstance(cls, payload)).map((e) => e.property);

describe('CreateTimeRuleBodyDto', () => {
  const valid = {
    ruleName: 'Bedtime',
    dayOfWeek: 1,
    startTime: '22:00',
    endTime: '23:30',
  };

  it('accepts a well formed rule', () => {
    expect(propertiesFor(CreateTimeRuleBodyDto, valid)).toEqual([]);
  });

  it('accepts the full day', () => {
    expect(
      propertiesFor(CreateTimeRuleBodyDto, {
        ...valid,
        startTime: '00:00',
        endTime: '23:59',
      }),
    ).toEqual([]);
  });

  it.each(['25:00', '24:00', '9:5', '9:05', '12:60', 'noon', 1200])(
    'rejects the end time %p',
    (endTime) => {
      expect(
        propertiesFor(CreateTimeRuleBodyDto, { ...valid, endTime }),
      ).toContain('endTime');
    },
  );

  it('rejects an invalid start time', () => {
    expect(
      propertiesFor(CreateTimeRuleBodyDto, { ...valid, startTime: '25:00' }),
    ).toContain('startTime');
  });

  it.each([1.5, 9, -1, 'x', null])('rejects the day %p', (dayOfWeek) => {
    expect(
      propertiesFor(CreateTimeRuleBodyDto, { ...valid, dayOfWeek }),
    ).toContain('dayOfWeek');
  });

  it.each([undefined, '', 5])('rejects the rule name %p', (ruleName) => {
    expect(
      propertiesFor(CreateTimeRuleBodyDto, { ...valid, ruleName }),
    ).toContain('ruleName');
  });
});

describe('UpdateTimeRuleBodyDto', () => {
  it('accepts an empty update', () => {
    expect(propertiesFor(UpdateTimeRuleBodyDto, {})).toEqual([]);
  });

  it('accepts a toggle', () => {
    expect(propertiesFor(UpdateTimeRuleBodyDto, { enabled: false })).toEqual(
      [],
    );
  });

  it('rejects an invalid time', () => {
    expect(
      propertiesFor(UpdateTimeRuleBodyDto, { startTime: '26:00' }),
    ).toContain('startTime');
  });

  it('rejects an invalid day', () => {
    expect(propertiesFor(UpdateTimeRuleBodyDto, { dayOfWeek: 1.5 })).toContain(
      'dayOfWeek',
    );
  });

  it('rejects an empty rule name', () => {
    expect(propertiesFor(UpdateTimeRuleBodyDto, { ruleName: '' })).toContain(
      'ruleName',
    );
  });
});

describe('TimeRulePresetBodyDto', () => {
  it('accepts a known preset', () => {
    expect(
      propertiesFor(TimeRulePresetBodyDto, { presetType: 'weekdays-only' }),
    ).toEqual([]);
  });

  it('rejects an unknown preset', () => {
    expect(
      propertiesFor(TimeRulePresetBodyDto, { presetType: 'nights' }),
    ).toContain('presetType');
  });
});

describe('BatchTimeRulesDto', () => {
  it('accepts a list of user ids', () => {
    expect(propertiesFor(BatchTimeRulesDto, { userIds: ['a', 'b'] })).toEqual(
      [],
    );
  });

  it.each([undefined, [], 'abc', [1], null, {}])(
    'rejects userIds %p',
    (userIds) => {
      expect(propertiesFor(BatchTimeRulesDto, { userIds })).toContain(
        'userIds',
      );
    },
  );
});
