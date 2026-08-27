/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "standalone" is intentionally NOT set here — the Dockerfile
  // ships the full node_modules + .next output and runs `npm run start`
  // (next start), because the app container's boot command runs
  // `npx prisma migrate deploy` first, which needs the full Prisma CLI
  // that a pruned standalone build doesn't reliably include. See README's
  // "Deviations from the original spec" section.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

module.exports = nextConfig;
