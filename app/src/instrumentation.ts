// รันตอน server เริ่ม (Next.js instrumentation hook) — ตั้งตัวกวาด "ร่างหมดเวลา" ทุก 60 วินาที
// คืนโต๊ะ/สต็อกที่กันไว้เกินเวลา (ดู lib/releaseExpired.ts) โดยไม่ต้องพึ่ง cron container
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { releaseExpiredHolds } = await import("./lib/releaseExpired");
  const tick = () => releaseExpiredHolds().catch((err) => console.error("[releaseExpired] tick failed:", err));
  setTimeout(tick, 15_000);
  setInterval(tick, 60_000);
}
