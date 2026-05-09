/**
 * Bounded most-recently-used list. Pure data structure used by the recent
 * AsciiDoc pages picker.
 */
export class RecentList {
  private readonly items: string[] = [];

  constructor(private readonly capacity: number = 20) {
    if (capacity <= 0) {
      throw new Error('RecentList capacity must be positive');
    }
  }

  /** Records access to `item`, promoting it to the front. */
  visit(item: string): void {
    const existing = this.items.indexOf(item);
    if (existing !== -1) {
      this.items.splice(existing, 1);
    }
    this.items.unshift(item);
    if (this.items.length > this.capacity) {
      this.items.length = this.capacity;
    }
  }

  /** Removes the item if present (use on file delete/rename). */
  forget(item: string): void {
    const idx = this.items.indexOf(item);
    if (idx !== -1) {
      this.items.splice(idx, 1);
    }
  }

  /** Snapshot of recent items, most-recent first. */
  list(): string[] {
    return [...this.items];
  }
}
