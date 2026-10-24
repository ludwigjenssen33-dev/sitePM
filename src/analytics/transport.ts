/** 4.2 is strictly local. The dormant server adapter remains in serverTransport.ts. */
export function analyticsDeliveryState() {
  return { configured: false, pending: 0 };
}
export async function flushAnalytics() {
  /* No event transmission in the local product. */
}
export function installAnalyticsSync() {
  return () => {};
}
