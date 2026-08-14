"use client";

import { createContext, useContext, useMemo } from "react";
import type { StoreProduct } from "@/lib/products";

interface ProductsState {
  products: StoreProduct[];
  getProduct: (slug: string) => StoreProduct | undefined;
}

const ProductsContext = createContext<ProductsState | null>(null);

/**
 * Server-resolved products (base price, sale window, stock, edited copy)
 * made available to client components — cart, drawer, shop grid, checkout.
 */
export function ProductsProvider({
  products,
  children,
}: {
  products: StoreProduct[];
  children: React.ReactNode;
}) {
  const value = useMemo<ProductsState>(
    () => ({
      products,
      getProduct: (slug) => products.find((p) => p.slug === slug),
    }),
    [products],
  );
  return (
    <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
  );
}

export function useProducts(): ProductsState {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}
