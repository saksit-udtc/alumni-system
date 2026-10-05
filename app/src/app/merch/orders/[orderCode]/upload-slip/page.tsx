"use client";

import { useParams, useSearchParams } from "next/navigation";
import PayPage from "@/app/components/pay-page";

export default function UploadSlipPage() {
  const { orderCode } = useParams<{ orderCode: string }>();
  const searchParams = useSearchParams();
  return <PayPage kind="merch" code={orderCode} initialPhone={searchParams.get("phone") || ""} />;
}
