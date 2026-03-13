import type { InventoryQuantity } from '@/types/pos';

export function normalizeInventoryQuantity(
  value: unknown,
  fallback: InventoryQuantity = 0
): InventoryQuantity {
  if (value === null) {
    return null;
  }

  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function isUnlimitedQuantity(qty: InventoryQuantity): qty is null {
  return qty === null;
}
