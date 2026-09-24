import type { Metadata } from "next";
import LandingView from "@/app/components/landing-view";

export const metadata: Metadata = {
  title: "รายละเอียดงานคืนสู่เหย้า 89 ปี วิทยาลัยเทคนิคอุดรธานี",
};

// หน้า Landing 89 ปี (เดิมอยู่ที่หน้าแรก) — ไปถึงได้จากการคลิกสไลด์ที่หน้าแรก
export default function Homecoming89Page() {
  return <LandingView variant="full" />;
}
