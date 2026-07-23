import { groupBy, sumBy, sortBy, calculatePercentage } from '../../../src/utils/stats/math-utils';

describe('math-utils', () => {
  describe('calculatePercentage', () => {
    it('should calculate percentage with default 1 decimal', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
    });

    it('should calculate percentage with custom decimals', () => {
      expect(calculatePercentage(1, 3, 2)).toBe(33.33);
    });

    it('should handle zero total', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it('should handle 100%', () => {
      expect(calculatePercentage(100, 100)).toBe(100);
    });

    it('should handle fractional values', () => {
      expect(calculatePercentage(1, 3)).toBe(33.3);
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, item => item.type);
      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });

    it('should return empty object for empty array', () => {
      const result = groupBy([], item => String(item));
      expect(result).toEqual({});
    });

    it('should handle single group', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'a', value: 2 },
      ];
      const result = groupBy(items, item => item.type);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result['a']).toHaveLength(2);
    });
  });

  describe('sumBy', () => {
    it('should sum values by function', () => {
      const items = [{ value: 1 }, { value: 2 }, { value: 3 }];
      expect(sumBy(items, item => item.value)).toBe(6);
    });

    it('should return 0 for empty array', () => {
      expect(sumBy([], item => (item as { value: number }).value)).toBe(0);
    });

    it('should handle single item', () => {
      const items = [{ value: 42 }];
      expect(sumBy(items, item => item.value)).toBe(42);
    });

    it('should handle negative values', () => {
      const items = [{ value: 1 }, { value: -2 }, { value: 3 }];
      expect(sumBy(items, item => item.value)).toBe(2);
    });
  });

  describe('sortBy', () => {
    it('should sort ascending by default', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const result = sortBy(items, item => item.value);
      expect(result).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
    });

    it('should sort descending when specified', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const result = sortBy(items, item => item.value, true);
      expect(result).toEqual([{ value: 3 }, { value: 2 }, { value: 1 }]);
    });

    it('should not mutate the original array', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      sortBy(items, item => item.value);
      expect(items).toEqual([{ value: 3 }, { value: 1 }, { value: 2 }]);
    });

    it('should handle empty array', () => {
      const result = sortBy([], item => (item as { value: number }).value);
      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const items = [{ value: 1 }];
      const result = sortBy(items, item => item.value);
      expect(result).toEqual([{ value: 1 }]);
    });
  });
});
