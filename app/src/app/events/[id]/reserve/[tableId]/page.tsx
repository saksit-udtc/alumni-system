"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ReserveForm from "./reserve-form";
import SiteNav from "@/app/components/site-nav";

// One bundled item line for the package-selector card below (see
// PackagePicker) — kept minimal, matches the shape /api/events/[id]/packages
// returns.
interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  price: string;
  items: {
    packageItemId: string;
    productName: string;
    size: string | null;
    quantity: number;
    buyerChoosesSize: boolean;
    availableSizes: string[];
  }[];
}

// Lets the guest pick a pre-configured package (table + bundled merch, one
// price) instead of a plain table booking — Phase 2 of the package
// feature. Entirely additive: when no active packages exist for this event
// (the common case today), this renders nothing and the page behaves
// exactly as it always has.
function PackagePicker({
  packages,
  pricePerTable,
  selected,
  onSelect,
  itemSizeSelections,
  onSelectSize,
}: {
  packages: PackageOption[];
  pricePerTable: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  itemSizeSelections: Record<string, string>;
  onSelectSize: (packageItemId: string, size: string) => void;
}) {
  const selectedPackage = packages.find((p) => p.id === selected) || null;
  return (
    <div className="bg-white border border-cream-200 shadow-md rounded-xl p-4 space-y-2">
      <div className="text-sm font-medium text-stone-700">เลือกรูปแบบการจอง</div>
      <label className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${selected === null ? "border-maroon-700 bg-primary-50" : "border-stone-200 hover:bg-cream-50"}`}>
        <input type="radio" checked={selected === null} onChange={() => onSelect(null)} className="mt-1 accent-maroon-700" />
        <span>
          <span className="block font-medium text-stone-800">จองโต๊ะปกติ</span>
          <span className="block text-sm text-stone-500">{pricePerTable.toLocaleString()} บาท</span>
        </span>
      </label>
      {packages.map((p) => (
        <label
          key={p.id}
          className={`flex items-start gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${selected === p.id ? "border-maroon-700 bg-primary-50" : "border-stone-200 hover:bg-cream-50"}`}
        >
          <input type="radio" checked={selected === p.id} onChange={() => onSelect(p.id)} className="mt-1 accent-maroon-700" />
          <span>
            <span className="block font-medium text-stone-800">{p.name}</span>
            <span className="block text-sm text-stone-500">{Number(p.price).toLocaleString()} บาท</span>
            {p.description && <span className="block text-xs text-stone-400">{p.description}</span>}
            {p.items.length > 0 && (
              <span className="block text-xs text-stone-400 mt-0.5">
                ของแถม:{" "}
                {p.items.map((it, i) => (
                  <span key={it.packageItemId}>
                    {i > 0 && ", "}
                    {it.productName}
                    {it.buyerChoosesSize ? " (เลือกไซส์เอง)" : it.size ? ` (${it.size})` : ""} x{it.quantity}
                  </span>
                ))}
              </span>
            )}
          </span>
        </label>
      ))}
      {selectedPackage && selectedPackage.items.some((it) => it.buyerChoosesSize) && (
        <div className="border-t border-cream-100 pt-2 mt-1 space-y-2">
          <span className="text-xs font-medium text-stone-700 block">เลือกไซส์</span>
          {selectedPackage.items
            .filter((it) => it.buyerChoosesSize)
            .map((it) => (
              <label key={it.packageItemId} className="flex items-center gap-2 text-sm">
                <span className="text-stone-600 min-w-0 flex-1 truncate">{it.productName}</span>
                <select
                  value={itemSizeSelections[it.packageItemId] || ""}
                  onChange={(e) => onSelectSize(it.packageItemId, e.target.value)}
                  className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">-- ไซส์ --</option>
                  {it.availableSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ReservePage() {
  const { id, tableId } = useParams<{ id: string; tableId: string }>();
  const searchParams = useSearchParams();
  void searchParams;
  // Seat-level booking has been disabled — every reservation is now a full-table booking.
  const bookingType = "full_table" as const;

  const [event, setEvent] = useState<any>(null);
  const [table, setTable] = useState<any>(null);
  const [error, setError] = useState("");
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [itemSizeSelections, setItemSizeSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setEvent(d.event);
        const t = d.tables?.find((x: any) => x.id === tableId);
        setTable(t);
      });
    // Best-effort — an event with no packages configured (the common case)
    // just gets an empty list here, and the picker below renders nothing.
    fetch(`/api/events/${id}/packages`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => setPackages([]));
  }, [id, tableId]);

  let content: React.ReactNode;

  if (error) {
    content = <p className="text-red-600">{error}</p>;
  } else if (!event || !table) {
    content = <p className="text-stone-500">กำลังโหลด...</p>;
  } else if (event.status !== "open") {
    content = <p className="text-red-600">งานนี้ปิดรับจองแล้ว</p>;
  } else if (table.seatsReserved !== 0 || table.isFullTableBooking) {
    content = <p className="text-red-600">โต๊ะนี้ถูกจองไปแล้ว</p>;
  } else {
    const seatsRemaining = table.seatsAvailable;
    const selectedPackage = packages.find((p) => p.id === selectedPackageId) || null;
    content = (
      <div className="space-y-4">
        <div>
          <a href={`/events/${id}`} className="text-sm text-maroon-700 hover:text-maroon-800 hover:underline">
            ← กลับไปหน้าจองโต๊ะ
          </a>
          <h1 className="text-2xl font-display font-semibold text-stone-800 mt-1">
            เหมาโต๊ะ — โต๊ะ {table.tableNumber}
          </h1>
          <p className="text-stone-500 text-sm">{event.name}</p>
        </div>
        {packages.length > 0 && (
          <PackagePicker
            packages={packages}
            pricePerTable={Number(event.pricePerTable)}
            selected={selectedPackageId}
            onSelect={(id) => {
              setSelectedPackageId(id);
              setItemSizeSelections({});
            }}
            itemSizeSelections={itemSizeSelections}
            onSelectSize={(packageItemId, size) => setItemSizeSelections((prev) => ({ ...prev, [packageItemId]: size }))}
          />
        )}
        <ReserveForm
          key={selectedPackageId ?? "plain"}
          eventId={id}
          tableId={tableId}
          bookingType={bookingType}
          capacity={table.capacity}
          seatsRemaining={seatsRemaining}
          pricePerTable={Number(event.pricePerTable)}
          pricePerSeat={Number(event.pricePerSeat)}
          packageId={selectedPackage?.id}
          packagePrice={selectedPackage ? Number(selectedPackage.price) : undefined}
          packageItemSizeSelections={itemSizeSelections}
          eventName={event.name}
          tableNumber={table.tableNumber}
          packageName={selectedPackage?.name}
        />
      </div>
    );
  }

  return (
    <div>
      <SiteNav />
      <main className="max-w-md mx-auto p-4">{content}</main>
    </div>
  );
}
