export interface StoredCartItem {
  slug: string;
  qty: number;
}

/** Browser storage is untrusted and may come from an older tab/version. */
export function normalizeCart(
  value: unknown,
  maxFor: (slug: string) => number,
): StoredCartItem[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.slug !== "string" ||
      !Number.isInteger(item.qty) ||
      item.qty <= 0
    )
      continue;
    const limit = maxFor(item.slug);
    if (limit <= 0) continue;
    quantities.set(
      item.slug,
      Math.min((quantities.get(item.slug) ?? 0) + item.qty, limit),
    );
  }
  return [...quantities].map(([slug, qty]) => ({ slug, qty }));
}
