/** Simple count-based inventory for tracking collected items (US-596). */
export class Inventory {
  private items: Map<string, number> = new Map();

  /** Add one of the given item (or increment count). */
  add(itemId: string): void {
    this.items.set(itemId, (this.items.get(itemId) ?? 0) + 1);
  }

  /** Check if the player has at least one of the given item. */
  has(itemId: string): boolean {
    return (this.items.get(itemId) ?? 0) > 0;
  }

  /** Get the count of a specific item. */
  count(itemId: string): number {
    return this.items.get(itemId) ?? 0;
  }

  /** Remove one of the given item. Returns true if the item was present. */
  remove(itemId: string): boolean {
    const current = this.items.get(itemId) ?? 0;
    if (current <= 0) return false;
    if (current === 1) {
      this.items.delete(itemId);
    } else {
      this.items.set(itemId, current - 1);
    }
    return true;
  }

  /** Get all item IDs (only those with count > 0). */
  getAll(): string[] {
    return Array.from(this.items.keys());
  }

  /** Clear all items. */
  clear(): void {
    this.items.clear();
  }
}
