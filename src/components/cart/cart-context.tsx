"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useProducts } from "@/components/product/products-context";
import { useTranslations } from "next-intl";
import { normalizeCart } from "@/lib/cart-storage";
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
  isReady: boolean;
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
  const t = useTranslations("common");
  const [announcement, setAnnouncement] = useState("");
  const lastStored = useRef<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const readCart = useCallback(
    (raw: string | null) => {
      try {
        return normalizeCart(raw ? JSON.parse(raw) : [], (slug) => {
          const p = getProduct(slug);
          return p ? Math.min(MAX_QTY_PER_ITEM, p.stock) : 0;
        });
      } catch {
        return [];
      }
    },
    [getProduct],
  );

  useEffect(() => {
    if (hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const restored = readCart(raw);
      lastStored.current = JSON.stringify(restored);
      // Restore external browser state after server rendering.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(restored);
    } catch {
      /* Browsing still works with storage disabled. */
    }
    setHydrated(true);
  }, [hydrated, readCart]);

  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(items);
    if (serialized === lastStored.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      lastStored.current = serialized;
    } catch {
      /* Keep an in-memory cart when persistence is unavailable. */
    }
  }, [items, hydrated]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const incoming = readCart(event.newValue);
      lastStored.current = JSON.stringify(incoming);
      setItems(incoming);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [readCart]);

  // When fresh product data arrives (e.g. router.refresh after a sold-out
  // checkout attempt), drop items that are gone and clamp to current stock.
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile authoritative server stock
    setItems((prev) =>
      prev.flatMap((i) => {
        const product = getProduct(i.slug);
        if (!product || isSoldOut(product)) return [];
        return [
          { ...i, qty: Math.min(i.qty, MAX_QTY_PER_ITEM, product.stock) },
        ];
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
      setAnnouncement(
        t("addedToCart", { name: getProduct(slug)?.name ?? slug }),
      );
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
    [maxQtyFor, getProduct, t],
  );

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const setQty = useCallback(
    (slug: string, qty: number) => {
      if (!Number.isFinite(qty)) return;
      qty = Math.trunc(qty);
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
      isReady: hydrated,
      openCart,
      closeCart,
      addItem,
      removeItem,
      setQty,
      clearCart,
    };
  }, [
    items,
    isOpen,
    hydrated,
    getProduct,
    openCart,
    closeCart,
    addItem,
    removeItem,
    setQty,
    clearCart,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
    </CartContext.Provider>
  );
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
