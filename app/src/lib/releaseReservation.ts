import { prisma } from "./prisma";
import { Prisma, PrismaClient } from "@prisma/client";

export class ReleaseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Shared release logic (requirement #2), used by BOTH:
 *  - the cron service (newStatus = 'expired')
 *  - the admin "reject slip" action (newStatus = 'rejected')
 *
 * Restores Table.seatsReserved, resets isFullTableBooking, and sets the
 * Reservation's paymentStatus. Never releases a confirmed (paid) reservation
 * — that throws. Already expired/rejected reservations are a no-op.
 */
export async function releaseReservation(
  reservationId: string,
  newStatus: "expired" | "rejected",
  client?: TxClient
): Promise<void> {
  const db = (client ?? prisma) as PrismaClient;

  const run = async (tx: TxClient) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; tableId: string; seatCount: number; paymentStatus: string }>
    >(Prisma.sql`
      SELECT "id", "tableId", "seatCount", "paymentStatus"
      FROM "Reservation"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `);

    const reservation = locked[0];
    if (!reservation) {
      throw new ReleaseError("NOT_FOUND", "ไม่พบการจองที่ระบุ");
    }

    if (reservation.paymentStatus === "confirmed") {
      throw new ReleaseError(
        "CANNOT_RELEASE_CONFIRMED",
        "ไม่สามารถยกเลิกการจองที่ชำระเงินยืนยันแล้วได้"
      );
    }

    if (reservation.paymentStatus === "expired" || reservation.paymentStatus === "rejected") {
      // Already released — no-op, so cron re-runs and duplicate admin
      // clicks are safe/idempotent.
      return;
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
  };

  if (client) {
    // Already inside a transaction (e.g. called from another tx) — reuse it.
    await run(client);
  } else {
    await prisma.$transaction(async (tx) => run(tx));
  }
}
