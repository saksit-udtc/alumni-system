"use client";

import { useParams, useSearchParams } from "next/navigation";
import PayPage from "@/app/components/pay-page";

export default function UploadSlipPage() {
  const { bookingCode } = useParams<{ bookingCode: string }>();
  const searchParams = useSearchParams();
  return <PayPage kind="reservation" code={bookingCode} initialPhone={searchParams.get("phone") || ""} />;
}
