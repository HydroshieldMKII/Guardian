import { StopCodeUtils } from '@/common/utils/stop-code.utils';

describe('StopCodeUtils', () => {
  describe('getStopCodeDescription', () => {
    it.each([
      ['DEVICE_PENDING', 'requires administrator approval'],
      ['DEVICE_REJECTED', 'explicitly rejected'],
      ['IP_POLICY_LAN_ONLY', 'local network only'],
      ['IP_POLICY_WAN_ONLY', 'external connections only'],
      ['IP_POLICY_NOT_ALLOWED', 'approved access list'],
      ['TIME_RESTRICTED', 'time-based scheduling restrictions'],
      ['CONCURRENT_LIMIT', 'concurrent stream limit'],
    ])('describes %s', (code, fragment) => {
      expect(StopCodeUtils.getStopCodeDescription(code)).toContain(fragment);
    });

    it('falls back to the raw code for unknown values', () => {
      expect(StopCodeUtils.getStopCodeDescription('SOMETHING_NEW')).toBe(
        'A streaming session was blocked: SOMETHING_NEW',
      );
    });

    it('falls back for an empty code', () => {
      expect(StopCodeUtils.getStopCodeDescription('')).toBe(
        'A streaming session was blocked: ',
      );
    });
  });
});
