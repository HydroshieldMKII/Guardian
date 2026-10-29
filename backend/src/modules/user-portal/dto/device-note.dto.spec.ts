import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DEVICE_NOTE_MAX_LENGTH,
  DeviceNoteDto,
} from '@/modules/user-portal/dto/device-note.dto';

const parse = (payload: Record<string, unknown>) =>
  plainToInstance(DeviceNoteDto, payload);

const invalidProperties = (payload: Record<string, unknown>) =>
  validateSync(parse(payload)).map((error) => error.property);

describe('DeviceNoteDto', () => {
  it.each([{}, { description: '' }, { description: 'my tablet' }])(
    'accepts %p',
    (payload) => {
      expect(invalidProperties(payload)).toEqual([]);
    },
  );

  it('accepts a note at the maximum length', () => {
    expect(
      invalidProperties({ description: 'a'.repeat(DEVICE_NOTE_MAX_LENGTH) }),
    ).toEqual([]);
  });

  it('rejects a note over the maximum length', () => {
    expect(
      invalidProperties({
        description: 'a'.repeat(DEVICE_NOTE_MAX_LENGTH + 1),
      }),
    ).toEqual(['description']);
  });

  it.each([
    { description: { text: 'x' } },
    { description: ['x'] },
    { description: 42 },
  ])('rejects a note that is not text: %p', (payload) => {
    expect(invalidProperties(payload)).toEqual(['description']);
  });

  it('trims surrounding whitespace', () => {
    expect(parse({ description: '  my tablet  ' }).description).toBe(
      'my tablet',
    );
  });
});
