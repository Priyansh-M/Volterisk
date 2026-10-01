export let bootError: Error | null = null;

export let ready: Promise<void> = Promise.resolve();

export function setReady(pending: Promise<void>): void {
  ready = pending.then(
    () => undefined,
    (error: unknown) => {
      bootError = error instanceof Error ? error : new Error(String(error));
      console.error(bootError);
      if (!process.env.VERCEL) throw bootError;
    },
  );
}
