import { Prisma, PosPaymentMethod } from "@prisma/client";
import { prisma } from "./prisma";
import { generateBookingCode, generateQrToken } from "./qrcode";
import { isValidEmailFormat, hasDeliverableEmailDomain } from "./validateEmail";
import { validateNamePart, validateThaiPhone, cleanPhoneForStorage, normalizeEmail } from "./formValidation";

export interface BookPackageInput {
  packageId: string;
  tableId: string;
  bookerName: string;
  bookerPhone: string;
  /** Optional — required for an online booking (Phase 2) so a confirmation
   * email can be sent, but a POS walk-up sale (Phase 1) doesn't need one. */
  bookerEmail?: string;
  partyNames?: string[];
  /** Object-storage key of an already-uploaded payment slip — same meaning
   * as BookTableInput.slipFileKey. Not used yet (POS never sets it), wired
   * in for the Phase 2 online-booking path. */
  slipFileKey?: string;
  /**
   * true for a POS counter sale: payment is already settled in person, so
   * the reservation is created directly as "confirmed" with paymentMethod/
   * cashierId recorded, instead of "pending"/"awaiting_verify".
   */
  immediateConfirm?: boolean;
  paymentMethod?: PosPaymentMethod;
  cashierId?: string;
}

export class PackageBookingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const HOLD_MINUTES = 20;

/**
 * Books a pre-configured Package (table booking + bundled merch items)
 * atomically. Mirrors bookTable.ts's transaction/locking pattern, plus a
 * race-safe stock decrement for every bundled item (mirrored from
 * createPosSale/createMerchOrder) inside the very same transaction — so a
 * package purchase either fully succeeds (table held + all items
 * decremented + one Reservation + its ReservationPackageItem snapshots) or
 * fully rolls back, never a half-applied state.
 */
export async function bookPackage(input: BookPackageInput) {
  const {
    packageId,
    tableId,
    bookerName,
    bookerPhone,
    bookerEmail,
    partyNames,
    slipFileKey,
    immediateConfirm,
    paymentMethod,
    cashierId,
  } = input;

  if (!bookerName?.trim() || !bookerPhone?.trim()) {
    throw new PackageBookingError("MISSING_FIELDS", "กรุณากรอกชื่อและเบอร์โทรศัพท์ผู้จอง");
  }
  {
    const nameParts = bookerName.trim().split(/\s+/);
    const namePartLabel = nameParts.length > 1 ? "ชื่อ-นามสกุล" : "ชื่อ";
    const nameErr = validateNamePart(bookerName, namePartLabel);
    if (nameErr) {
      throw new PackageBookingError("INVALID_NAME", nameErr);
    }
  }
  {
    const phoneErr = validateThaiPhone(bookerPhone);
    if (phoneErr) {
      throw new PackageBookingError("INVALID_PHONE", phoneErr);
    }
  }
  let normalizedEmail: string | null = null;
  if (bookerEmail?.trim()) {
    normalizedEmail = normalizeEmail(bookerEmail);
    if (!isValidEmailFormat(normalizedEmail)) {
      throw new PackageBookingError("INVALID_EMAIL", "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง");
    }
    // Same reasoning as bookTable.ts — done outside the DB transaction
    // since it's a DNS lookup.
    const deliverable = await hasDeliverableEmailDomain(normalizedEmail);
    if (!deliverable) {
      throw new PackageBookingError(
        "UNDELIVERABLE_EMAIL",
        "ไม่พบเซิร์ฟเวอร์รับอีเมลสำหรับโดเมนนี้ กรุณาตรวจสอบอีเมลอีกครั้ง"
      );
    }
  }

  if (immediateConfirm && (!paymentMethod || !cashierId)) {
    throw new PackageBookingError("MISSING_PAYMENT_INFO", "ต้องระบุวิธีชำระเงินและผู้ขายสำหรับการขายหน้างาน");
  }

  return prisma.$transaction(
    async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId },
        include: { items: true },
      });
      if (!pkg) {
        throw new PackageBookingError("PACKAGE_NOT_FOUND", "ไม่พบแพ็กเกจที่ระบุ");
      }
      if (!pkg.active) {
        throw new PackageBookingError("PACKAGE_INACTIVE", "แพ็กเกจนี้ถูกปิดการขายแล้ว");
      }

      // Row-level lock on the target table — identical pattern to
      // bookTable.ts, so a plain table booking and a package booking on the
      // same table serialize against each other too.
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
        throw new PackageBookingError("TABLE_NOT_FOUND", "ไม่พบโต๊ะที่ระบุ");
      }
      if (table.eventId !== pkg.eventId) {
        throw new PackageBookingError("EVENT_MISMATCH", "โต๊ะนี้ไม่ได้อยู่ในงานเดียวกับแพ็กเกจ");
      }

      const event = await tx.event.findUnique({ where: { id: pkg.eventId } });
      if (!event) {
        throw new PackageBookingError("EVENT_NOT_FOUND", "ไม่พบงานที่ระบุ");
      }
      if (event.status !== "open") {
        throw new PackageBookingError("EVENT_NOT_OPEN", "งานนี้ไม่เปิดให้จองในขณะนี้");
      }

      if (pkg.bookingType === "full_table") {
        if (table.seatsReserved !== 0) {
          throw new PackageBookingError("TABLE_NOT_EMPTY", "โต๊ะนี้มีการจองบางส่วนแล้ว ไม่สามารถจองทั้งโต๊ะได้");
        }
        if (pkg.seatCount !== table.capacity) {
          throw new PackageBookingError(
            "SEAT_COUNT_MISMATCH",
            "แพ็กเกจนี้ตั้งจำนวนที่นั่งไม่ตรงกับความจุของโต๊ะ กรุณาแจ้งผู้ดูแลระบบ"
          );
        }
      } else {
        if (table.isFullTableBooking) {
          throw new PackageBookingError("TABLE_FULLY_BOOKED", "โต๊ะนี้ถูกจองเต็มทั้งโต๊ะแล้ว");
        }
        if (table.seatsReserved + pkg.seatCount > table.capacity) {
          throw new PackageBookingError("NOT_ENOUGH_SEATS", "ที่นั่งว่างไม่เพียงพอ");
        }
      }

      // Race-safe stock decrement for every bundled item — same
      // updateMany-with-a-quantity-floor pattern as createPosSale/
      // createMerchOrder (matched by plain productId+size fields rather
      // than the productId_size compound-unique helper, same as those two,
      // since size can be null), run for each item inside this same
      // transaction so an out-of-stock item rolls back the table hold too.
      const itemSnapshots: Array<{
        productId: string;
        productName: string;
        size: string | null;
        quantity: number;
      }> = [];

      for (const item of pkg.items) {
        const result = await tx.merchProductStock.updateMany({
          where: { productId: item.productId, size: item.size, quantity: { gte: item.quantity } },
          data: { quantity: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          const product = await tx.merchProduct.findUnique({ where: { id: item.productId } });
          const label = item.size ? `${product?.name ?? "สินค้า"} (ไซส์ ${item.size})` : product?.name ?? "สินค้า";
          throw new PackageBookingError("ITEM_OUT_OF_STOCK", `สินค้าในแพ็กเกจ "${label}" มีไม่เพียงพอ`);
        }
        const product = await tx.merchProduct.findUnique({ where: { id: item.productId } });
        itemSnapshots.push({
          productId: item.productId,
          productName: product?.name ?? "สินค้า",
          size: item.size,
          quantity: item.quantity,
        });
      }

      // Unique booking code, retrying on the rare collision — same as
      // bookTable.ts.
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
          eventId: pkg.eventId,
          tableId,
          bookingType: pkg.bookingType,
          seatCount: pkg.seatCount,
          bookerName: bookerName.trim(),
          bookerPhone: cleanPhoneForStorage(bookerPhone),
          bookerEmail: normalizedEmail,
          partyNames: partyNames && partyNames.length ? partyNames : Prisma.JsonNull,
          paymentStatus: immediateConfirm ? "confirmed" : slipFileKey ? "awaiting_verify" : "pending",
          totalAmount: pkg.price,
          reservedUntil,
          qrCodeToken: generateQrToken(),
          packageId: pkg.id,
          paymentMethod: immediateConfirm ? paymentMethod : null,
          cashierId: immediateConfirm ? cashierId : null,
        },
      });

      if (slipFileKey) {
        await tx.paymentSlip.create({
          data: { reservationId: reservation.id, fileKey: slipFileKey },
        });
      }

      for (const snap of itemSnapshots) {
        await tx.reservationPackageItem.create({
          data: {
            reservationId: reservation.id,
            productId: snap.productId,
            productName: snap.productName,
            size: snap.size,
            quantity: snap.quantity,
          },
        });
      }

      await tx.table.update({
        where: { id: tableId },
        data: {
          seatsReserved: { increment: pkg.seatCount },
          isFullTableBooking: pkg.bookingType === "full_table" ? true : table.isFullTableBooking,
        },
      });

      return reservation;
    },
    {
      // Same widened budget as bookTable.ts — this transaction does even
      // more work (per-item stock lookups on top of the table lock), so it
      // needs at least as much headroom.
      maxWait: 10_000,
      timeout: 15_000,
    }
  );
}
