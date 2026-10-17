"use client";

import { useEffect, useMemo, useState } from "react";
import { THAI_PROVINCES, type ThaiAddress } from "@/lib/thaiAddress";

// ข้อมูลจังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์ (public/thai-address.json) — โหลดครั้งเดียวแล้วแคชไว้
// รูปแบบ: [จังหวัด, [[อำเภอ, [[ตำบล, รหัสไปรษณีย์], ...]], ...]][]
type AddressData = [string, [string, [string, string][]][]][];
let dataPromise: Promise<AddressData> | null = null;
function loadAddressData(): Promise<AddressData> {
  if (!dataPromise) {
    dataPromise = fetch("/thai-address.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .catch((e) => {
        dataPromise = null; // ให้ลองโหลดใหม่ได้ในครั้งถัดไป
        throw e;
      });
  }
  return dataPromise;
}

// ฟอร์มที่อยู่จัดส่งแบบแยกช่อง (ใช้ร่วมกันทั้งหน้าชำระเงินของที่ระลึกและหน้าแพ็กเกจ)
// เลือก จังหวัด → อำเภอ/เขต → ตำบล/แขวง แล้วรหัสไปรษณีย์จะถูกเลือกให้อัตโนมัติ
// errors: key = addrLine / addrSubdistrict / addrDistrict / addrProvince / addrPostcode
export default function AddressFields({
  value,
  onChange,
  errors,
  idPrefix = "",
  onTouch,
}: {
  value: ThaiAddress;
  onChange: (next: ThaiAddress) => void;
  errors: Record<string, string>;
  idPrefix?: string;
  onTouch?: (field: string) => void;
}) {
  const [data, setData] = useState<AddressData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAddressData()
      .then((d) => alive && setData(d))
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const set = (patch: Partial<ThaiAddress>) => onChange({ ...value, ...patch });

  const districts = useMemo(() => data?.find((p) => p[0] === value.province)?.[1] ?? [], [data, value.province]);
  const subdistricts = useMemo(
    () => districts.find((d) => d[0] === value.district)?.[1] ?? [],
    [districts, value.district]
  );
  const postcodes = useMemo(
    () => [...new Set(subdistricts.map((s) => s[1]))].sort(),
    [subdistricts]
  );

  const cls = (key: string, disabled = false) =>
    `border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 transition-shadow ${
      disabled ? "bg-stone-100 text-stone-400 cursor-not-allowed " : "bg-white "
    }${
      errors[key]
        ? "border-red-400 focus:ring-red-300 focus:border-red-500"
        : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"
    }`;
  const label = (text: string) => (
    <span className="font-medium text-stone-700">
      {text} <span className="text-red-600">*</span>
    </span>
  );
  const err = (key: string) => (errors[key] ? <span className="text-xs text-red-600">{errors[key]}</span> : null);

  // ถ้าโหลดข้อมูลรายการไม่ได้ → ให้พิมพ์เองได้ (ระบบยังใช้งานได้)
  const manual = loadFailed || !!value.manual;
  const noProvince = !value.province;
  const noDistrict = !value.district;

  return (
    <div className="space-y-3 text-sm">
      <div className="font-medium text-stone-700">
        ที่อยู่สำหรับจัดส่ง <span className="text-red-600">*</span>
      </div>

      <label className="flex flex-col gap-1">
        {label("บ้านเลขที่ / หมู่ / ซอย / ถนน")}
        <input
          id={`${idPrefix}addrLine`}
          value={value.line}
          onChange={(e) => set({ line: e.target.value })}
          onBlur={() => onTouch?.("addrLine")}
          autoComplete="address-line1"
          maxLength={200}
          placeholder="เช่น 123 หมู่ 4 ซอยสุขสบาย ถนนทหาร"
          className={cls("addrLine")}
        />
        {err("addrLine")}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          {label("จังหวัด")}
          <select
            id={`${idPrefix}addrProvince`}
            value={value.province}
            onChange={(e) => set({ province: e.target.value, district: "", subdistrict: "", postcode: "" })}
            onBlur={() => onTouch?.("addrProvince")}
            autoComplete="address-level1"
            className={cls("addrProvince")}
          >
            <option value="">— เลือกจังหวัด —</option>
            {THAI_PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {err("addrProvince")}
        </label>

        <label className="flex flex-col gap-1">
          {label("อำเภอ / เขต")}
          {manual ? (
            <input
              id={`${idPrefix}addrDistrict`}
              value={value.district}
              onChange={(e) => set({ district: e.target.value })}
              onBlur={() => onTouch?.("addrDistrict")}
              maxLength={80}
              className={cls("addrDistrict")}
            />
          ) : (
            <select
              id={`${idPrefix}addrDistrict`}
              value={value.district}
              disabled={noProvince || !data}
              onChange={(e) => set({ district: e.target.value, subdistrict: "", postcode: "" })}
              onBlur={() => onTouch?.("addrDistrict")}
              className={cls("addrDistrict", noProvince || !data)}
            >
              <option value="">{noProvince ? "เลือกจังหวัดก่อน" : !data ? "กำลังโหลด..." : "— เลือกอำเภอ/เขต —"}</option>
              {districts.map((d) => (
                <option key={d[0]} value={d[0]}>
                  {d[0]}
                </option>
              ))}
            </select>
          )}
          {err("addrDistrict")}
        </label>

        <label className="flex flex-col gap-1">
          {label("ตำบล / แขวง")}
          {manual ? (
            <input
              id={`${idPrefix}addrSubdistrict`}
              value={value.subdistrict}
              onChange={(e) => set({ subdistrict: e.target.value })}
              onBlur={() => onTouch?.("addrSubdistrict")}
              maxLength={80}
              className={cls("addrSubdistrict")}
            />
          ) : (
            <select
              id={`${idPrefix}addrSubdistrict`}
              value={value.subdistrict}
              disabled={noDistrict}
              onChange={(e) => {
                const sub = subdistricts.find((s) => s[0] === e.target.value);
                set({ subdistrict: e.target.value, postcode: sub?.[1] ?? "" });
              }}
              onBlur={() => onTouch?.("addrSubdistrict")}
              className={cls("addrSubdistrict", noDistrict)}
            >
              <option value="">{noDistrict ? "เลือกอำเภอ/เขตก่อน" : "— เลือกตำบล/แขวง —"}</option>
              {subdistricts.map((s) => (
                <option key={s[0]} value={s[0]}>
                  {s[0]}
                </option>
              ))}
            </select>
          )}
          {err("addrSubdistrict")}
        </label>

        <label className="flex flex-col gap-1">
          {label("รหัสไปรษณีย์")}
          {manual ? (
            <input
              id={`${idPrefix}addrPostcode`}
              value={value.postcode}
              onChange={(e) => set({ postcode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
              onBlur={() => onTouch?.("addrPostcode")}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="5 หลัก"
              className={cls("addrPostcode")}
            />
          ) : (
            <select
              id={`${idPrefix}addrPostcode`}
              value={value.postcode}
              disabled={noDistrict}
              onChange={(e) => set({ postcode: e.target.value })}
              onBlur={() => onTouch?.("addrPostcode")}
              autoComplete="postal-code"
              className={cls("addrPostcode", noDistrict)}
            >
              <option value="">{noDistrict ? "เลือกอำเภอ/เขตก่อน" : "— เลือกรหัสไปรษณีย์ —"}</option>
              {postcodes.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          )}
          {err("addrPostcode")}
        </label>
      </div>

      {!loadFailed && (
        <label className="flex items-start gap-2 text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value.manual}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? { ...value, manual: true }
                  : { ...value, manual: false, district: "", subdistrict: "", postcode: "" }
              )
            }
            className="accent-maroon-700 mt-0.5"
          />
          <span>
            ไม่พบที่อยู่ของฉันในรายการ (กรอกอำเภอ ตำบล และรหัสไปรษณีย์เอง)
            <span className="block text-xs text-stone-400">เจ้าหน้าที่จะตรวจสอบที่อยู่อีกครั้งก่อนจัดส่ง</span>
          </span>
        </label>
      )}
    </div>
  );
}
