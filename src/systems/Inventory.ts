/** Simple string-based inventory for tracking collected items. */
export class Inventory {
  private items: Set<string> = new Set();

  add(itemId: string): void {
    this.items.add(itemId);
  }

  has(itemId: string): boolean {
    return this.items.has(itemId);
  }

  remove(itemId: string): boolean {
    return this.items.delete(itemId);
  }

  getAll(): string[] {
    return Array.from(this.items);
  }

  clear(): void {
    this.items.clear();
  }
}
