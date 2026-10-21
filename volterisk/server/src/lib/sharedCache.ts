/** One shared read per TTL across all viewers. `clear()` after any write that changes it. */
export function sharedCache<T>(ttlMs: number, read: () => Promise<T>) {
  let entry: { at: number; value: Promise<T> } | null = null;
  return {
    get(): Promise<T> {
      if (process.env.VITEST) return read();
      if (entry && Date.now() - entry.at < ttlMs) return entry.value;
      const value = read();
      const mine = { at: Date.now(), value };
      entry = mine;
      value.catch(() => {
        if (entry === mine) entry = null;
      });
      return value;
    },
    clear() {
      entry = null;
    },
  };
}
