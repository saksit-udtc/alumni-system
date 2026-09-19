import { getPosterSetting, DEFAULT_POSTER_URL } from "./settings";
import { publicLandingAssetUrl } from "./minio";

/** URL ของโปสเตอร์ที่ใช้งานอยู่ (อัปโหลดแล้ว → MinIO public, ไม่เช่นนั้น → ภาพเริ่มต้น) */
export async function getPosterInfo(): Promise<{ enabled: boolean; imageUrl: string; isDefault: boolean }> {
  const s = await getPosterSetting();
  return {
    enabled: s.enabled,
    imageUrl: s.imageKey ? publicLandingAssetUrl(s.imageKey) : DEFAULT_POSTER_URL,
    isDefault: !s.imageKey,
  };
}
