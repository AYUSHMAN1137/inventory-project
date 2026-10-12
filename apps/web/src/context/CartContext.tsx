import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { CartLine, Item } from '../types';

interface CartContextValue {
  lines: CartLine[];
  count: number;
  add: (item: Item, quantity?: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
  has: (itemId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((item: Item, quantity = 1) => {
    // Never let a line ask for more than physically available.
    const max = Math.max(item.availableQuantity, 1);
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id
            ? { ...l, quantity: Math.min(l.quantity + quantity, max) }
            : l,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          unitOfMeasure: item.unitOfMeasure,
          nature: item.nature,
          trackingMode: item.trackingMode,
          quantity: Math.min(quantity, max),
          availableQuantity: item.availableQuantity,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(0, quantity) } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const has = useCallback((itemId: string) => lines.some((l) => l.itemId === itemId), [lines]);

  const value = useMemo<CartContextValue>(
    () => ({ lines, count: lines.length, add, setQuantity, remove, clear, has }),
    [lines, add, setQuantity, remove, clear, has],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
