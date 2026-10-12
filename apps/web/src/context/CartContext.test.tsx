import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CartProvider, useCart } from '../context/CartContext';
import type { Item } from '../types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Arduino Uno R3',
    model: null,
    description: null,
    categoryId: 'cat-1',
    categoryName: 'Microcontrollers',
    nature: 'RETURNABLE',
    trackingMode: 'SERIALIZED',
    unitOfMeasure: 'pcs',
    lowStockThreshold: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    availableQuantity: 3,
    totalQuantity: 5,
    isLowStock: false,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

describe('CartContext', () => {
  it('adds an item and reports the line count', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(makeItem());
    });

    expect(result.current.count).toBe(1);
    expect(result.current.lines[0]).toMatchObject({ itemId: 'item-1', quantity: 1 });
  });

  it('never lets a cart line exceed the available quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(makeItem({ availableQuantity: 2 }), 5);
    });

    expect(result.current.lines[0].quantity).toBe(2);
  });

  it('merges repeat additions of the same item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(makeItem());
    });
    act(() => {
      result.current.add(makeItem());
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].quantity).toBe(2);
  });

  it('removes a line when its quantity is dropped to zero', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(makeItem());
    });
    act(() => {
      result.current.setQuantity('item-1', 0);
    });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.has('item-1')).toBe(false);
  });

  it('clears every line', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.add(makeItem());
      result.current.add(makeItem({ id: 'item-2', name: 'ESP32' }));
    });
    expect(result.current.count).toBe(2);

    act(() => {
      result.current.clear();
    });

    expect(result.current.count).toBe(0);
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useCart())).toThrow(/must be used inside CartProvider/);
  });
});
