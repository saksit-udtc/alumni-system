import { prisma } from "./prisma";
import crypto from "crypto";

export class WithdrawalError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface CreateWithdrawalInput {
  createdById: string;
  requesterName: string;
  requesterPosition?: string;
  purpose: string;
  approverName: string;
  note?: string;
  items: { stockId: string; quantity: number }[];
}

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let c = "";
  for (let i = 0; i < 6; i++) c += alphabet[bytes[i] % alphabet.length];
  return `WD-${c}`;
}

/** สร้างใบเบิก + ตัดสต๊อกทันทีแบบ atomic (guard จำนวนเหมือน POS) — ไม่เกี่ยวกับรายรับ */
export async function createWithdrawal(input: CreateWithdrawalInput) {
  const requesterName = input.requesterName?.trim();
  const purpose = input.purpose?.trim();
  const approverName = input.approverName?.trim();
  if (!requesterName) throw new WithdrawalError("REQUESTER", "กรุณากรอกชื่อผู้เบิก");
  if (!purpose) throw new WithdrawalError("PURPOSE", "กรุณากรอกวัตถุประสงค์การเบิก");
  if (!approverName) throw new WithdrawalError("APPROVER", "กรุณากรอกชื่อผู้อนุมัติ");

  const merged = new Map<string, number>();
  for (const it of input.items || []) {
    if (!it?.stockId) continue;
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new WithdrawalError("QTY", "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0");
    merged.set(it.stockId, (merged.get(it.stockId) || 0) + it.quantity);
  }
  if (merged.size === 0) throw new WithdrawalError("EMPTY", "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");

  const stocks = await prisma.merchProductStock.findMany({ where: { id: { in: [...merged.keys()] } }, include: { product: true } });
  const byId = new Map(stocks.map((s) => [s.id, s]));
  const itemsData = [...merged].map(([stockId, quantity]) => {
    const st = byId.get(stockId);
    if (!st || !st.product) throw new WithdrawalError("NOT_FOUND", "ไม่พบสินค้าที่เลือก");
    return { productId: st.productId, productName: st.product.name, size: st.size, quantity, unitPrice: Number(st.product.price) };
  });

  let code = genCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.merchWithdrawal.findUnique({ where: { code } }))) break;
    code = genCode();
  }

  return prisma.$transaction(async (tx) => {
    for (const [stockId, quantity] of merged) {
      const st = byId.get(stockId)!;
      const r = await tx.merchProductStock.updateMany({ where: { id: stockId, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
      if (r.count === 0) {
        const label = st.size ? `${st.product!.name} (ไซส์ ${st.size})` : st.product!.name;
        throw new WithdrawalError("OUT_OF_STOCK", `สินค้า "${label}" มีไม่เพียงพอ`);
      }
    }
    return tx.merchWithdrawal.create({
      data: {
        code,
        requesterName,
        requesterPosition: input.requesterPosition?.trim() || null,
        purpose,
        approverName,
        note: input.note?.trim() || null,
        createdById: input.createdById,
        items: { create: itemsData },
      },
      include: { items: true, createdBy: { select: { username: true } } },
    });
  });
}

/** ยกเลิกใบเบิก + คืนสต๊อก — เรียกซ้ำปลอดภัย (updateMany มีเงื่อนไขสถานะ) */
export async function cancelWithdrawal(id: string, reason: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const moved = await tx.merchWithdrawal.updateMany({
      where: { id, status: "active" },
      data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason },
    });
    if (moved.count === 0) return false;
    const items = await tx.merchWithdrawalItem.findMany({ where: { withdrawalId: id } });
    for (const it of items) {
      const stock = it.productId ? await tx.merchProductStock.findFirst({ where: { productId: it.productId, size: it.size } }) : null;
      if (stock) await tx.merchProductStock.update({ where: { id: stock.id }, data: { quantity: { increment: it.quantity } } });
      else if (it.productId) await tx.merchProductStock.create({ data: { productId: it.productId, size: it.size, quantity: it.quantity } });
    }
    return true;
  });
}
