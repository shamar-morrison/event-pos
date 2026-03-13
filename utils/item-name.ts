export interface NormalizedEventItemName {
  displayName: string;
  nameKey: string;
}

export const DUPLICATE_EVENT_ITEM_ERROR =
  'This item already exists for this event. Use Restock to add more quantity.';

export function normalizeEventItemName(name: string): NormalizedEventItemName {
  const displayName = name.trim().replace(/\s+/g, ' ');

  return {
    displayName,
    nameKey: displayName.toLowerCase(),
  };
}

export function findEventItemByName<T extends { name: string }>(
  items: Iterable<T>,
  candidateName: string
): T | undefined {
  const { nameKey } = normalizeEventItemName(candidateName);
  if (!nameKey) {
    return undefined;
  }

  for (const item of items) {
    if (normalizeEventItemName(item.name).nameKey === nameKey) {
      return item;
    }
  }

  return undefined;
}
