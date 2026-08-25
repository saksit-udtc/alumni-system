import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Duplicated copy of app/src/lib/releaseReservation.ts's core logic — the
 * cron service is a separate small Node process/container (per spec) with
 * its own package.json and its own generated Prisma client, so it cannot
 * import TypeScript directly from the Next.js app package. Keep this in
 * sync with app/src/lib/releaseReservation.ts if the business rule changes.
 */
export class ReleaseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function releaseReservation(
  prisma: PrismaClient,
  reservationId: string,
  newStatus: "expired" | "rejected"
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; tableId: string; seatCount: number; paymentStatus: string }>
    >(Prisma.sql`
      SELECT "id", "tableId", "seatCount", "paymentStatus"
      FROM "Reservation"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `);

    const reservation = locked[0];
    if (!reservation) throw new ReleaseError("NOT_FOUND", "reservation not found");

    if (reservation.paymentStatus === "confirmed") {
      throw new ReleaseError("CANNOT_RELEASE_CONFIRMED", "cannot release a confirmed reservation");
    }

    if (reservation.paymentStatus === "expired" || reservation.paymentStatus === "rejected") {
      return; // no-op, already released
    }

    await tx.reservation.update({
      where: { id: reservationId },
      data: { paymentStatus: newStatus },
    });

    await tx.table.update({
      where: { id: reservation.tableId },
      data: {
        seatsReserved: { decrement: reservation.seatCount },
        isFullTableBooking: false,
      },
    });
  });
}
