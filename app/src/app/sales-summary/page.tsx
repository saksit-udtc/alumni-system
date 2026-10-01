"use client";

import SalesSummaryView from "@/app/components/sales-summary-view";

export default function PublicSalesSummaryPage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <SalesSummaryView apiUrl="/api/public/sales-summary" title="สรุปยอดสินค้าและโต๊ะ งานคืนสู่เหย้า" showMoney={false} />
    </main>
  );
}
