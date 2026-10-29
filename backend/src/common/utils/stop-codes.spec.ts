import {
  describeStopCode,
  GENERIC_BLOCK_DESCRIPTION,
  StopCode,
  stopCodeReason,
} from '@/common/utils/stop-codes';

describe('stop codes', () => {
  it.each<[StopCode, string]>([
    ['DEVICE_PENDING', 'requires administrator approval'],
    ['DEVICE_REJECTED', 'explicitly rejected'],
    ['IP_POLICY_LAN_ONLY', 'local network only'],
    ['IP_POLICY_WAN_ONLY', 'external connections only'],
    ['IP_POLICY_NOT_ALLOWED', 'approved access list'],
    ['TIME_RESTRICTED', 'time-based scheduling restrictions'],
    ['CONCURRENT_LIMIT', 'concurrent stream limit'],
  ])('describes %s', (code, fragment) => {
    expect(describeStopCode(code)).toContain(fragment);
  });

  it('describes a block without a stop code generically', () => {
    expect(describeStopCode(undefined)).toBe(GENERIC_BLOCK_DESCRIPTION);
  });

  it.each<[StopCode, string]>([
    ['DEVICE_PENDING', 'device needs approval'],
    ['TIME_RESTRICTED', "user schedule doesn't allow streaming at this moment"],
    ['CONCURRENT_LIMIT', 'user exceeded concurrent stream limit'],
  ])('gives %s a short reason', (code, reason) => {
    expect(stopCodeReason(code)).toBe(reason);
  });
});
