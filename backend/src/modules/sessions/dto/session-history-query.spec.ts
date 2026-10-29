import {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  parseHistoryLimit,
  parseHistoryOffset,
} from './session-history-query';

describe('parseHistoryLimit', () => {
  it.each([
    [undefined, DEFAULT_HISTORY_LIMIT],
    ['abc', DEFAULT_HISTORY_LIMIT],
    ['-5', DEFAULT_HISTORY_LIMIT],
    ['0', DEFAULT_HISTORY_LIMIT],
    ['1.5', DEFAULT_HISTORY_LIMIT],
    ['25', 25],
    ['99999999999', MAX_HISTORY_LIMIT],
    ['1e30', DEFAULT_HISTORY_LIMIT],
    ['99999999999999999999999', DEFAULT_HISTORY_LIMIT],
  ])('turns %p into %p', (raw, expected) => {
    expect(parseHistoryLimit(raw)).toBe(expected);
  });
});

describe('parseHistoryOffset', () => {
  it.each([
    [undefined, 0],
    ['abc', 0],
    ['-1', 0],
    ['2.5', 0],
    ['0', 0],
    ['75', 75],
  ])('turns %p into %p', (raw, expected) => {
    expect(parseHistoryOffset(raw)).toBe(expected);
  });
});
