/**
 * Wird von Next.js einmal beim Serverstart ausgeführt.
 * Siehe node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md
 */
export async function register() {
  // Nur im Node-Prozess, nicht in der Edge-Runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startRetentionScheduler } = await import("@/lib/scheduler");
  startRetentionScheduler();
}
