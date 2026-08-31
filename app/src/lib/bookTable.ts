import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { generateBookingCode, generateQrToken } from "./qrcode";
import { isValidEmailFormat, hasDeliverableEmailDomain } from "./validateEmail";

export interface BookTableInput {
  eventId: string;
  tableId: string;
  bookingType: "full_table" | "seats";
  seatCount: number;
  bookerName: string;
  bookerPhone: string;
  bookerEmail: string;
  partyNames?: string[];
  /** Object-storage key of an already-uploaded payment slip (see
   * lib/minio.ts's uploadObject) — the slip is now attached in the same
   * step as the booking form itself (one page, one submit) rather than a
   * separate upload-slip page, so when present the reservation is created
   * directly in "awaiting_verify" status with its PaymentSlip row, in the
   * same transaction. */
  slipFileKey?: string;
}

export class BookingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const HOLD_MINUTES = 20;

/**
 * Books a table atomically. Requirement #1.
 *
 * Uses a single prisma.$transaction. Inside it we first take a row lock on
 * the Table with a raw `SELECT ... FOR UPDATE` so concurrent bookings on the
 * same table serialize instead of racing on seatsReserved. All validation,
 * the Reservation insert, and the Table update happen inside that same
 * transaction, so any failure rolls back everything atomically.
 */
export async function bookTable(input: BookTableInput) {
  const {
    eventId,
    tableId,
    bookingType,
    seatCount,
    bookerName,
    bookerPhone,
    bookerEmail,
    partyNames,
    slipFileKey,
  } = input;

  if (seatCount <= 0) {
    throw new BookingError("INVALID_SEAT_COUNT", "จำนวนที่นั่งต้องมากกว่า 0");
  }
  if (!bookerName?.trim() || !bookerPhone?.trim() || !bookerEmail?.trim()) {
    throw new BookingError("MISSING_FIELDS", "กรุณากรอกชื่อ เบอร์โทรศัพท์ และอีเมล");
  }
  {
    const email = bookerEmail.trim();
    if (!isValidEmailFormat(email)) {
      throw new BookingError("INVALID_EMAIL", "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
    }
    // Done outside the DB transaction — it's a DNS lookup (network I/O), and
    // holding the table row lock / DB connection open while waiting on that
    // would be wasteful and could tie up the transaction's timeout budget.
    const deliverable = await hasDeliverableEmailDomain(email);
    if (!deliverable) {
      throw new BookingError(
        "UNDELIVERABLE_EMAIL",
        "ไม่พบเซิร์ฟเวอร์รับอีเมลสำหรับโดเมนนี้ กรุณาตรวจสอบอีเมลอีกครั้ง"
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    // Row-level lock: raw SELECT ... FOR UPDATE on the target table row.
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        eventId: string;
        capacity: number;
        seatsReserved: number;
        isFullTableBooking: boolean;
      }>
    >(Prisma.sql`
      SELECT "id", "eventId", "capacity", "seatsReserved", "isFullTableBooking"
      FROM "Table"
      WHERE "id" = ${tableId}
      FOR UPDATE
    `);

    const table = locked[0];
    if (!table) {
      throw new BookingError("TABLE_NOT_FOUND", "ไม่พบโต๊ะที่ระบุ");
    }
    // Anti-IDOR: the locked table must actually belong to the given event.
    if (table.eventId !== eventId) {
      throw new BookingError("EVENT_MISMATCH", "โต๊ะนี้ไม่ได้อยู่ในงานที่ระบุ");
    }

    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new BookingError("EVENT_NOT_FOUND", "ไม่พบงานที่ระบุ");
    }
    if (event.status !== "open") {
      throw new BookingError("EVENT_NOT_OPEN", "งานนี้ไม่เปิดให้จองในขณะนี้");
    }

    if (bookingType === "full_table") {
      if (table.seatsReserved !== 0) {
        throw new BookingError("TABLE_NOT_EMPTY", "โต๊ะนี้มีการจองบางส่วนแล้ว ไม่สามารถจองทั้งโต๊ะได้");
      }
      if (seatCount !== table.capacity) {
        throw new BookingError(
          "SEAT_COUNT_MISMATCH",
          "การจองทั้งโต๊ะต้องระบุจำนวนที่นั่งเท่ากับความจุของโต๊ะ"
        );
      }
    } else {
      if (table.isFullTableBooking) {
        throw new BookingError("TABLE_FULLY_BOOKED", "โต๊ะนี้ถูกจองเต็มทั้งโต๊ะแล้ว");
      }
      if (table.seatsReserved + seatCount > table.capacity) {
        throw new BookingError("NOT_ENOUGH_SEATS", "ที่นั่งว่างไม่เพียงพอ");
      }
    }

    const totalAmount =
      bookingType === "full_table"
        ? Number(event.pricePerTable)
        : Number(event.pricePerSeat) * seatCount;

    // Generate a unique booking code, retrying on the rare collision.
    let bookingCode = generateBookingCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await tx.reservation.findUnique({ where: { bookingCode } });
      if (!exists) break;
      bookingCode = generateBookingCode();
    }

    const reservedUntil = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

    const reservation = await tx.reservation.create({
      data: {
        bookingCode,
        eventId,
        tableId,
        bookingType,
        seatCount,
        bookerName: bookerName.trim(),
        bookerPhone: bookerPhone.trim(),
        bookerEmail: bookerEmail?.trim() || null,
        partyNames: partyNames && partyNames.length ? partyNames : Prisma.JsonNull,
        paymentStatus: slipFileKey ? "awaiting_verify" : "pending",
        totalAmount,
        reservedUntil,
        qrCodeToken: generateQrToken(),
      },
    });

    if (slipFileKey) {
      await tx.paymentSlip.create({
        data: { reservationId: reservation.id, fileKey: slipFileKey },
      });
    }

    await tx.table.update({
      where: { id: tableId },
      data: {
        seatsReserved: { increment: seatCount },
        isFullTableBooking: bookingType === "full_table" ? true : table.isFullTableBooking,
      },
    });

    return reservation;
  }, {
    // Defaults (maxWait: 2s, timeout: 5s) are too tight for a dev server's
    // cold start (first request after `npm run dev` pays webpack-compile +
    // Prisma engine startup cost, which alone can exceed 2s) — that alone
    // was enough to trip P2028 "unable to start a transaction in the given
    // time" on the very first booking attempt. Widened for headroom under
    // real concurrent load too, not just cold starts.
    maxWait: 10_000,
    timeout: 15_000,
  });
}
