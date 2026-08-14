"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useProducts } from "@/components/product/products-context";
import { effectivePrice, isSoldOut } from "@/lib/pricing";
import { DELIVERY_FEE, MAX_QTY_PER_ITEM } from "@/lib/constants";

export interface CartItem {
  slug: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (slug: string) => void;
  removeItem: (slug: string) => void;
  setQty: (slug: string, qty: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartState | null>(null);

const STORAGE_KEY = "lune-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { getProduct } = useProducts();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        // Drop unknown and sold-out slugs; clamp qty to available stock
        setItems(
          parsed.flatMap((i) => {
            const product = getProduct(i.slug);
            if (!product || isSoldOut(product) || i.qty <= 0) return [];
            return [{ ...i, qty: Math.min(i.qty, MAX_QTY_PER_ITEM, product.stock) }];
          }),
        );
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, [hydrated, getProduct]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  // When fresh product data arrives (e.g. router.refresh after a sold-out
  // checkout attempt), drop items that are gone and clamp to current stock.
  useEffect(() => {
    if (!hydrated) return;
    setItems((prev) =>
      prev.flatMap((i) => {
        const product = getProduct(i.slug);
        if (!product || isSoldOut(product)) return [];
        return [{ ...i, qty: Math.min(i.qty, MAX_QTY_PER_ITEM, product.stock) }];
      }),
    );
  }, [hydrated, getProduct]);

  const maxQtyFor = useCallback(
    (slug: string) => {
      const product = getProduct(slug);
      return Math.min(MAX_QTY_PER_ITEM, product ? product.stock : 0);
    },
    [getProduct],
  );

  const addItem = useCallback(
    (slug: string) => {
      const limit = maxQtyFor(slug);
      if (limit <= 0) return;
      setItems((prev) => {
        const existing = prev.find((i) => i.slug === slug);
        if (existing) {
          return prev.map((i) =>
            i.slug === slug ? { ...i, qty: Math.min(i.qty + 1, limit) } : i,
          );
        }
        return [...prev, { slug, qty: 1 }];
      });
    },
    [maxQtyFor],
  );

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setQty = useCallback(
    (slug: string, qty: number) => {
      const limit = maxQtyFor(slug);
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => i.slug !== slug)
          : prev.map((i) =>
              i.slug === slug ? { ...i, qty: Math.min(qty, limit) } : i,
            ),
      );
    },
    [maxQtyFor],
  );

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartState>(() => {
    const subtotal = items.reduce((sum, i) => {
      const product = getProduct(i.slug);
      return sum + (product ? effectivePrice(product).price * i.qty : 0);
    }, 0);
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    return {
      items,
      count,
      subtotal,
      deliveryFee: items.length > 0 ? DELIVERY_FEE : 0,
      total: subtotal + (items.length > 0 ? DELIVERY_FEE : 0),
      isOpen,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      clearCart,
    };
  }, [items, isOpen, getProduct, openCart, closeCart, addItem, removeItem, setQty, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
