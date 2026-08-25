"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FloorPlanEditor from "./floor-plan-editor";

interface TableItem {
  id: string;
  tableNumber: number;
  zone: string | null;
  zoneColor: string | null;
  positionX: number | null;
  positionY: number | null;
}

export default function FloorPlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [eventName, setEventName] = useState("");
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [tables, setTables] = useState<TableItem[] | null>(null);

  useEffect(() => {
    fetch(`/api/admin/events/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setEventName(d.event.name);
        setFloorPlanUrl(d.event.floorPlanPublicUrl || null);
        setTables(d.event.tables || []);
      });
  }, [id]);

  if (!tables) return <p className="text-sm text-gray-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-bold">ผังพื้นที่งาน (Custom Floor Plan) — {eventName}</h1>
      <FloorPlanEditor eventId={id} initialFloorPlanUrl={floorPlanUrl} tables={tables} />
    </div>
  );
}
