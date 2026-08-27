"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "draft", label: "ร่าง (ยังไม่เปิดให้เห็น)" },
  { value: "open", label: "เปิดให้จอง" },
  { value: "closed", label: "ปิดรับจอง" },
];

// Ported from the old Supabase app's status-toggle.tsx, pointed at the new
// scaffold's admin-only PATCH endpoint (the old app's public /api/events/[id]
// PATCH doesn't exist here — status changes are an admin-only action).
export default function StatusToggle({ eventId, status }: { eventId: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  async function handleChange(newStatus: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
    if (res.ok) {
      setCurrent(newStatus);
      router.refresh();
    }
  }

  return (
    <select
      value={current}
      disabled={saving}
      onChange={(e) => handleChange(e.target.value)}
      className="border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-1.5 text-sm"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
