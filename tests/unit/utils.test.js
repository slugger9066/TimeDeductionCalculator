const { validateDurationParts, toTotalSeconds, breakdown } = require('../../server');

describe('duration utilities', () => {
  test('validateDurationParts accepts numeric strings and numbers, rejects negatives and non-numeric', () => {
    expect(validateDurationParts({ days: '1', hours: 2 })).toBe(true);
    expect(validateDurationParts({ minutes: 30, seconds: '15' })).toBe(true);
    expect(validateDurationParts({ hours: -1 })).toBe(false);
    expect(validateDurationParts({ seconds: 'abc' })).toBe(false);
  });

  test('toTotalSeconds calculates correctly', () => {
    expect(toTotalSeconds({ hours: 1 })).toBe(3600);
    expect(toTotalSeconds({ days: 1, hours: 1 })).toBe((1*24+1)*3600);
    expect(toTotalSeconds({ minutes: '2', seconds: '30' })).toBe(150);
  });

  test('breakdown produces correct fields', () => {
    expect(breakdown(90061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(breakdown(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
