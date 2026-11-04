// Safe network retries for creating tickets, comments and notes.
//
// Each logical submission gets one Idempotency-Key. If the response is lost (timeout, dropped connection) the user
// resubmits the same content and the same key is sent again, so the server replays its stored answer instead of
// creating a second record. Editing the content starts a new submission with a new key.

export const newIdempotencyKey = (): string => {
  const c: any = typeof globalThis !== "undefined" ? (globalThis as any).crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export interface KeyTracker {
  // The key for a submission with this content signature: unchanged for a retry, new after the content changed.
  keyFor(signature: string): string;
  // Forget the key once the submission succeeded, so the next submission starts fresh.
  reset(): void;
}

export const createKeyTracker = (): KeyTracker => {
  let current: { signature: string; key: string } | null = null;
  return {
    keyFor(signature) {
      if (!current || current.signature !== signature) current = { signature, key: newIdempotencyKey() };
      return current.key;
    },
    reset() {
      current = null;
    }
  };
};
