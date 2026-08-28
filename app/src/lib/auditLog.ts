import { prisma } from "@/lib/prisma";

/**
 * Fire-and-forget audit logging. Never throws out to the caller — a logging
 * failure (e.g. a transient DB hiccup) must never block the actual admin
 * action or the public page it's attached to, matching this project's
 * fail-soft pattern used elsewhere (see lib/email.ts).
 */
export async function logAdminAction(params: {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "ADMIN",
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        detail: params.detail,
      },
    });
  } catch (err) {
    console.error("logAdminAction failed", err);
  }
}

/** Records an anonymous visit to a public page — path + timestamp only, no visitor identity. */
export async function logPublicView(path: string) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "PUBLIC",
        action: "PAGE_VIEW",
        path,
      },
    });
  } catch (err) {
    console.error("logPublicView failed", err);
  }
}

/** Records whether a transactional email actually went out — never throws (best-effort, matches mailer.ts's own fail-soft contract). */
export async function logEmail(params: { type: string; recipient: string; status: "SUCCESS" | "FAILED"; error?: string }) {
  try {
    await prisma.emailLog.create({
      data: {
        type: params.type,
        recipient: params.recipient,
        status: params.status,
        error: params.error,
      },
    });
  } catch (err) {
    console.error("logEmail failed", err);
  }
}
