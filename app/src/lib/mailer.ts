import nodemailer from "nodemailer";
import { Resend } from "resend";
import { generateQrPngBuffer, checkinUrl } from "./qrcode";

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

interface ConfirmationEmailArgs {
  to: string;
  bookerName: string;
  eventName: string;
  tableNumber: number;
  bookingCode: string;
  qrCodeToken: string;
}

function buildHtml(args: ConfirmationEmailArgs) {
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ยืนยันการจองโต๊ะสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>การจองของท่านสำหรับงาน <strong>${args.eventName}</strong> ได้รับการยืนยันแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
        <li>โต๊ะหมายเลข: <strong>${args.tableNumber}</strong></li>
      </ul>
      <p>กรุณาแสดง QR Code นี้ที่จุดลงทะเบียนหน้างาน</p>
      <img src="cid:qrcode-checkin" alt="QR Code" width="250" height="250" />
    </div>
  `;
}

/**
 * Resend path. Tried first if RESEND_API_KEY is set (matches the old
 * Supabase app's implementation) — the user has a working Resend key from
 * that system and would rather reuse it than stand up SMTP from scratch.
 * Resend's attachment API takes a base64 string + `contentId`, unlike
 * nodemailer's Buffer + `cid`, so the QR buffer is base64-encoded here.
 */
async function sendViaResend(args: ConfirmationEmailArgs): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const qrBuffer = await generateQrPngBuffer(checkinUrl(args.qrCodeToken));

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: args.to,
    subject: `ยืนยันการจองโต๊ะ - ${args.eventName}`,
    html: buildHtml(args),
    attachments: [
      {
        filename: "checkin-qr.png",
        content: qrBuffer.toString("base64"),
        contentId: "qrcode-checkin",
      },
    ],
  });

  if (error) {
    throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  }
}

/**
 * SMTP path (nodemailer), unchanged from the original scaffold — used as a
 * fallback when RESEND_API_KEY is not set but SMTP_HOST is.
 */
async function sendViaSmtp(args: ConfirmationEmailArgs): Promise<void> {
  const qrBuffer = await generateQrPngBuffer(checkinUrl(args.qrCodeToken));
  const transport = getTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
    to: args.to,
    subject: `ยืนยันการจองโต๊ะ - ${args.eventName}`,
    html: buildHtml(args),
    attachments: [
      {
        filename: "checkin-qr.png",
        content: qrBuffer,
        cid: "qrcode-checkin",
      },
    ],
  });
}

/**
 * Sends the confirmation email with an inline QR code (CID attachment, not a
 * data-URI) pointing at the admin check-in URL. Per business rule #4, this
 * function MUST NEVER throw out to its caller — any failure (bad env,
 * network issue) is caught and logged so it never blocks slip approval.
 *
 * Provider selection: Resend first (if RESEND_API_KEY is set), else SMTP
 * (if SMTP_HOST is set), else skip with a warning. This lets the user reuse
 * their existing Resend API key from the old system without needing to also
 * configure SMTP.
 */
export async function sendConfirmationEmail(args: ConfirmationEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(args);
      return;
    }
    if (process.env.SMTP_HOST) {
      await sendViaSmtp(args);
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping confirmation email"
    );
  } catch (err) {
    console.error("[mailer] failed to send confirmation email (non-fatal):", err);
  }
}

interface BookingReceivedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  eventName: string;
  tableNumber: number | null;
  zone: string | null;
  bookingType: "full_table" | "seats";
  seatCount: number;
  totalAmount: number;
  bookingCode: string;
}

// Same URL shape the booking form itself navigates to after a successful
// booking (see reserve-form.tsx) — the phone number is required there as
// the shared-secret pairing with the booking code (anti-IDOR: neither alone
// is enough to look up someone else's reservation).
function uploadSlipUrl(bookingCode: string, bookerPhone: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/reservations/${bookingCode}/upload-slip?phone=${encodeURIComponent(bookerPhone)}`;
}

function buildBookingReceivedHtml(args: BookingReceivedEmailArgs) {
  const slipUrl = uploadSlipUrl(args.bookingCode, args.bookerPhone);
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>จองโต๊ะสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับการจองของท่านสำหรับงาน <strong>${args.eventName}</strong> เรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
        ${args.tableNumber ? `<li>โต๊ะหมายเลข: <strong>${args.tableNumber}${args.zone ? ` (โซน ${args.zone})` : ""}</strong></li>` : ""}
        <li>${args.bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} · ${args.seatCount} ที่นั่ง</li>
        <li>ยอดชำระ: <strong>${args.totalAmount.toLocaleString("th-TH")} บาท</strong></li>
      </ul>
      <p>กรุณาชำระเงินและอัปโหลดสลิปการโอนเพื่อยืนยันการจอง เมื่อเจ้าหน้าที่ตรวจสอบสลิปเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันพร้อม QR Code สำหรับเช็คอินหน้างานให้อีกครั้ง</p>
      <p style="margin: 20px 0;">
        <a href="${slipUrl}" style="display:inline-block; background:#1e3a8a; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px;">อัปโหลดสลิปการโอนเงิน</a>
      </p>
      <p style="color:#64748b; font-size:12px;">หรือคัดลอกลิงก์นี้: ${slipUrl}</p>
    </div>
  `;
}

/**
 * Sent right after a booking is created (no QR yet — that only goes out once
 * an admin approves the payment slip via sendConfirmationEmail above). Same
 * fail-soft contract: never throws, so a bad/missing RESEND_API_KEY or SMTP
 * config can never block the booking itself. Ported from the old Supabase
 * app's sendBookingReceivedEmail.
 */
export async function sendBookingReceivedEmail(args: BookingReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `จองโต๊ะสำเร็จ - ${args.eventName}`,
        html: buildBookingReceivedHtml(args),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `จองโต๊ะสำเร็จ - ${args.eventName}`,
        html: buildBookingReceivedHtml(args),
      });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping booking-received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send booking-received email (non-fatal):", err);
  }
}

interface MerchOrderConfirmedEmailArgs {
  to: string;
  bookerName: string;
  orderCode: string;
  shippingAddress: string;
  totalAmount: number;
  items: { productName: string; size: string | null; quantity: number }[];
}

function buildMerchOrderConfirmedHtml(args: MerchOrderConfirmedEmailArgs) {
  const rows = args.items
    .map(
      (it) =>
        `<li>${it.productName}${it.size ? ` (ไซส์ ${it.size})` : ""} × ${it.quantity}</li>`
    )
    .join("");
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ยืนยันการสั่งซื้อของที่ระลึกสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>การสั่งซื้อของที่ระลึกของท่านได้รับการตรวจสอบและยืนยันเรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการสั่งซื้อ: <strong>${args.orderCode}</strong></li>
        <li>ยอดชำระ: <strong>${args.totalAmount.toLocaleString("th-TH")} บาท</strong></li>
      </ul>
      <p><strong>รายการสินค้า:</strong></p>
      <ul>${rows}</ul>
      <p><strong>จัดส่งไปที่:</strong><br/>${args.shippingAddress.replace(/\n/g, "<br/>")}</p>
      <p>ทางวิทยาลัยจะดำเนินการจัดส่งสินค้าตามที่อยู่ที่ท่านแจ้งไว้ ขอบคุณที่อุดหนุนของที่ระลึกงานคืนสู่เหย้าครับ/ค่ะ</p>
    </div>
  `;
}

/**
 * Sent once an admin approves a merch order's payment slip (paymentStatus ->
 * confirmed) — the merch equivalent of sendConfirmationEmail above, minus
 * the check-in QR (merch orders aren't checked in at the event). Same
 * fail-soft contract: never throws, so a bad/missing mail config can never
 * block slip approval.
 */
export async function sendMerchOrderConfirmedEmail(args: MerchOrderConfirmedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `ยืนยันการสั่งซื้อของที่ระลึก - ${args.orderCode}`,
        html: buildMerchOrderConfirmedHtml(args),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `ยืนยันการสั่งซื้อของที่ระลึก - ${args.orderCode}`,
        html: buildMerchOrderConfirmedHtml(args),
      });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch order confirmed email"
    );
  } catch (err) {
    console.error("[mailer] failed to send merch order confirmed email (non-fatal):", err);
  }
}

interface SlipReceivedEmailArgs {
  to: string;
  bookerName: string;
  eventName: string;
  bookingCode: string;
}

function buildSlipReceivedHtml(args: SlipReceivedEmailArgs) {
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ได้รับสลิปแล้ว รอตรวจสอบ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับสลิปการโอนเงินสำหรับการจองของท่านในงาน <strong>${args.eventName}</strong> เรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
      </ul>
      <p>เจ้าหน้าที่กำลังตรวจสอบสลิปของท่าน เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันพร้อม QR Code สำหรับเช็คอินหน้างานให้อีกครั้ง</p>
    </div>
  `;
}

/**
 * Sent right after a payment slip is uploaded (paymentStatus -> awaiting_
 * verify), before an admin has reviewed it — sets the booker's expectation
 * that the slip arrived and what happens next, distinct from both the
 * earlier "booking received" email (no slip yet) and the later "confirmed"
 * email with the check-in QR (only sent once an admin approves). Same
 * fail-soft contract as the other mailer functions: never throws, so a bad/
 * missing RESEND_API_KEY or SMTP config can never block the slip upload
 * itself.
 */
export async function sendSlipReceivedEmail(args: SlipReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.eventName}`,
        html: buildSlipReceivedHtml(args),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.eventName}`,
        html: buildSlipReceivedHtml(args),
      });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping slip-received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send slip-received email (non-fatal):", err);
  }
}
