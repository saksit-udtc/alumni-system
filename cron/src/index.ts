import { PrismaClient } from "@prisma/client";
import cron from "node-cron";
import { releaseReservation } from "./releaseReservation";

const prisma = new PrismaClient();

/**
 * Requirement #3: every 5 minutes, find reservations where
 * paymentStatus IN ('pending','awaiting_verify') AND reservedUntil < now(),
 * and release each one via the shared release logic with newStatus='expired'.
 */
async function releaseExpiredReservations(): Promise<void> {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: {
      paymentStatus: { in: ["pending", "awaiting_verify"] },
      reservedUntil: { lt: now },
    },
    select: { id: true, bookingCode: true },
  });

  if (expired.length === 0) {
    console.log(`[cron] ${now.toISOString()} — no expired reservations`);
    return;
  }

  console.log(`[cron] ${now.toISOString()} — releasing ${expired.length} expired reservation(s)`);

  for (const r of expired) {
    try {
      await releaseReservation(prisma, r.id, "expired");
      console.log(`[cron] released ${r.bookingCode}`);
    } catch (err) {
      // One bad row must never stop the batch — log and continue.
      console.error(`[cron] failed to release ${r.bookingCode}:`, err);
    }
  }
}

const schedule = process.env.CRON_SCHEDULE || "*/5 * * * *";
console.log(`[cron] alumni-homecoming cron service starting, schedule="${schedule}"`);

cron.schedule(schedule, () => {
  releaseExpiredReservations().catch((err) => console.error("[cron] unexpected error:", err));
});

// Run once immediately on boot too, so a container restart doesn't wait a
// full interval before the first sweep.
releaseExpiredReservations().catch((err) => console.error("[cron] initial run error:", err));

process.on("SIGTERM", async () => {
  console.log("[cron] SIGTERM received, shutting down");
  await prisma.$disconnect();
  process.exit(0);
});
