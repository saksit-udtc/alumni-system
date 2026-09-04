import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PAYMENT_SLIPS_BUCKET = process.env.MINIO_SLIPS_BUCKET || "payment-slips";
export const FLOOR_PLANS_BUCKET = process.env.MINIO_FLOORPLANS_BUCKET || "floor-plans";
export const MERCH_PRODUCTS_BUCKET = process.env.MINIO_MERCH_BUCKET || "merch-products";
export const HOME_BANNERS_BUCKET = process.env.MINIO_HOMEBANNERS_BUCKET || "home-banners";
export const LANDING_GALLERY_BUCKET = process.env.MINIO_LANDINGGALLERY_BUCKET || "landing-gallery";
export const LANDING_ASSETS_BUCKET = process.env.MINIO_LANDINGASSETS_BUCKET || "landing-assets";

const PUBLIC_BUCKETS = new Set([FLOOR_PLANS_BUCKET, MERCH_PRODUCTS_BUCKET, HOME_BANNERS_BUCKET, LANDING_GALLERY_BUCKET, LANDING_ASSETS_BUCKET]);

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://minio:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
  forcePathStyle: true,
});

// Presigning client — used only to generate presigned GET URLs. Must sign
// against the PUBLIC endpoint (e.g. https://files.udontech.ac.th), because
// the resulting URL is opened directly by the admin's browser, which cannot
// resolve the internal Docker hostname "minio". Signing with the wrong host
// produces a URL the browser can't reach at all.
const s3Public = new S3Client({
  endpoint: process.env.MINIO_PUBLIC_URL || process.env.MINIO_ENDPOINT || "http://minio:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
  forcePathStyle: true,
});

// Tracks which buckets we've already confirmed exist this process, so a
// hot path doesn't re-check on every upload.
const knownBuckets = new Set<string>();

/**
 * In production, minio-init creates every bucket up front (see
 * docker-compose.yml). Local dev often runs a bare MinIO container without
 * that init step, so a bucket added here in code (like home-banners) can be
 * missing and every upload to it 500s with NoSuchBucket. Creating it
 * on-demand keeps local dev working without a manual `mc mb` step, and is a
 * no-op in production since minio-init already created it.
 */
async function ensureBucket(bucket: string): Promise<void> {
  if (knownBuckets.has(bucket)) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket })).catch((err) => {
      console.error(`[minio] failed to auto-create bucket "${bucket}":`, err);
      throw err;
    });
    // Public buckets (floor-plans, merch-products, home-banners) get their
    // anonymous-download policy from minio-init in production. When this
    // fallback creates the bucket instead (local dev without minio-init),
    // apply the same public-read policy so the freshly-created bucket
    // behaves the same way — private buckets never reach this branch.
    if (PUBLIC_BUCKETS.has(bucket)) {
      await s3
        .send(
          new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: "*",
                  Action: "s3:GetObject",
                  Resource: `arn:aws:s3:::${bucket}/*`,
                },
              ],
            }),
          })
        )
        .catch((err) => console.error(`[minio] failed to set public-read policy on "${bucket}":`, err));
    }
  }
  knownBuckets.add(bucket);
}

export async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await ensureBucket(bucket);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Payment slips are private — always accessed by admins via a short-lived
 * presigned GET URL, never a public bucket policy.
 */
export async function presignedGetUrl(bucket: string, key: string, expiresInSeconds = 300): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Public, cmd, { expiresIn: expiresInSeconds });
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Floor plans are set to a public-read bucket policy by minio-init (see
 * docker-compose.yml) since they are non-sensitive marketing/venue images
 * shown to all guests — this lets the public event page load them directly
 * via a stable public URL instead of round-tripping a presigned URL through
 * the Next.js server on every page view. Payment slips remain fully private.
 */
export function publicFloorPlanUrl(key: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${FLOOR_PLANS_BUCKET}/${key}`;
}

/**
 * Merch product photos are set to a public-read bucket policy by minio-init
 * (see docker-compose.yml), same rationale as floor plans — non-sensitive
 * images shown to all guests on the public shop page.
 */
export function publicMerchProductUrl(key: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${MERCH_PRODUCTS_BUCKET}/${key}`;
}

/**
 * Homepage banner images are set to a public-read bucket policy by
 * minio-init (see docker-compose.yml), same rationale as floor plans and
 * merch photos — non-sensitive promotional images shown to all guests on
 * the public homepage.
 */
export function publicHomeBannerUrl(key: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${HOME_BANNERS_BUCKET}/${key}`;
}

/**
 * Landing-page gallery photos are set to a public-read bucket policy by
 * minio-init (see docker-compose.yml), same rationale as the other public
 * buckets above — non-sensitive photos shown to all visitors on the public
 * homepage's gallery section.
 */
export function publicLandingGalleryUrl(key: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${LANDING_GALLERY_BUCKET}/${key}`;
}

/**
 * Single-image assets embedded directly in the landing content JSON (hero
 * background, honor-guest photos, sponsor logos) — unlike the gallery,
 * these aren't their own DB rows, just a URL string stored on the
 * corresponding LandingContent field. Public-read, same rationale as the
 * other public buckets above.
 */
export function publicLandingAssetUrl(key: string): string {
  const base = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";
  return `${base}/${LANDING_ASSETS_BUCKET}/${key}`;
}
