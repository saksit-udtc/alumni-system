"use client";
// ตะกร้าของที่ระลึก ใช้ร่วมกัน 3 หน้า (/merch → /merch/cart → /merch/checkout)
// เก็บใน localStorage ของเบราว์เซอร์ (ถ้าใช้ไม่ได้จะเก็บในหน่วยความจำของหน้านั้นแทน)
import { useCallback, useEffect, useState } from "react";

export interface CartLine {
  productId: string;
  name: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}

const KEY = "merchCart.v1";
const EVT = "merch-cart-changed";
let mem: CartLine[] | null = null;

function isLine(l: unknown): l is CartLine {
  const x = l as CartLine;
  return !!x && typeof x.productId === "string" && typeof x.name === "string" && Number(x.quantity) > 0 && Number.isFinite(Number(x.unitPrice));
}

function getCart(): CartLine[] {
  if (mem === null) {
    try {
      const raw = window.localStorage.getItem(KEY);
      const v = raw ? JSON.parse(raw) : [];
      mem = Array.isArray(v) ? v.filter(isLine) : [];
    } catch {
      mem = [];
    }
  }
  return mem;
}

function setCartLines(lines: CartLine[]) {
  mem = lines;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* ใช้หน่วยความจำแทน */
  }
  window.dispatchEvent(new Event(EVT));
}

export function useMerchCart() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // อ่านจาก storage ใหม่ทุกครั้งที่เปิดหน้า (กันค่าค้างข้ามแท็บ)
    mem = null;
    const sync = () => setCart([...getCart()]);
    sync();
    setReady(true);
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        mem = null;
        sync();
      }
    });
    return () => window.removeEventListener(EVT, sync);
  }, []);

  const addLine = useCallback((line: CartLine) => {
    const prev = getCart();
    const i = prev.findIndex((l) => l.productId === line.productId && (l.size || "") === (line.size || ""));
    if (i >= 0) {
      const next = [...prev];
      next[i] = { ...next[i], quantity: next[i].quantity + line.quantity };
      setCartLines(next);
    } else {
      setCartLines([...prev, line]);
    }
  }, []);

  const removeLine = useCallback((index: number) => {
    setCartLines(getCart().filter((_, i) => i !== index));
  }, []);

  const setQuantity = useCallback((index: number, quantity: number) => {
    const next = getCart().map((l, i) => (i === index ? { ...l, quantity: Math.max(1, quantity) } : l));
    setCartLines(next);
  }, []);

  const clear = useCallback(() => setCartLines([]), []);

  return { cart, ready, addLine, removeLine, setQuantity, clear };
}
