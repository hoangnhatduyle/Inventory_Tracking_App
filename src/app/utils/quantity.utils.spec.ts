import { getRemainingQuantity } from './quantity.utils';

describe('getRemainingQuantity', () => {
  it('returns the tracked current quantity, not the stored quantity', () => {
    expect(getRemainingQuantity({ quantity: 1, currentQuantity: 0.24 })).toBe(0.24);
  });

  it('returns 0 when the item is used up', () => {
    expect(getRemainingQuantity({ quantity: 0.62, currentQuantity: 0 })).toBe(0);
  });

  it('falls back to quantity when usage is not tracked', () => {
    expect(getRemainingQuantity({ quantity: 3 })).toBe(3);
    expect(getRemainingQuantity({ quantity: 3, currentQuantity: undefined })).toBe(3);
  });
});
