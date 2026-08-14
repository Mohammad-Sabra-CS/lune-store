"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getProduct } from "@/data/products";
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
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        setItems(parsed.filter((i) => getProduct(i.slug) && i.qty > 0));
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, hydrated]);

  const addItem = useCallback((slug: string) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.slug === slug);
      if (existing) {
        return prev.map((i) =>
          i.slug === slug ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY_PER_ITEM) } : i,
        );
      }
      return [...prev, { slug, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setQty = useCallback((slug: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.slug !== slug)
        : prev.map((i) =>
            i.slug === slug ? { ...i, qty: Math.min(qty, MAX_QTY_PER_ITEM) } : i,
          ),
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartState>(() => {
    const subtotal = items.reduce((sum, i) => {
      const product = getProduct(i.slug);
      return sum + (product ? product.price * i.qty : 0);
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
  }, [items, isOpen, openCart, closeCart, addItem, removeItem, setQty, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
