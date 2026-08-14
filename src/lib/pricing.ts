/**
 * Pure pricing helpers, safe on both server and client.
 *
 * Sale dates may arrive as Date objects (Drizzle) or ISO strings (dev JSON
 * store, RSC → client props) — always normalize before comparing.
 */

export interface Saleable {
  /** Current base price in whole JD */
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | string | null;
  saleEndsAt: Date | string | null;
  stock: number;
}

export interface EffectivePrice {
  /** What the customer pays right now */
  price: number;
  basePrice: number;
  onSale: boolean;
}

function toDate(value: Date | string | null): Date | null {
  return value == null ? null : new Date(value);
}

export function effectivePrice(p: Saleable, now: Date = new Date()): EffectivePrice {
  const basePrice = p.price;
  if (p.salePrice != null && p.salePrice < basePrice) {
    const start = toDate(p.saleStartsAt);
    const end = toDate(p.saleEndsAt);
    const started = !start || now >= start;
    const notEnded = !end || now <= end;
    if (started && notEnded) {
      return { price: p.salePrice, basePrice, onSale: true };
    }
  }
  return { price: basePrice, basePrice, onSale: false };
}

export function isSoldOut(p: Pick<Saleable, "stock">): boolean {
  return p.stock <= 0;
}
