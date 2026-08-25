import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PAYMENT_SLIPS_BUCKET = process.env.MINIO_SLIPS_BUCKET || "payment-slips";
export const FLOOR_PLANS_BUCKET = process.env.MINIO_FLOORPLANS_BUCKET || "floor-plans";

export const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || "http://minio:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || "minioadmin",
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  },
  forcePathStyle: true,
});

export async function uploadObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
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
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
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
