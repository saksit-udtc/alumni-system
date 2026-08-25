/** @type {import('next').NextConfig} */
const nextConfig = {
  // docker-compose.yml's app service runs `node server.js` after build —
  // that file only exists when Next.js is built with output: "standalone"
  // (it bundles a minimal self-contained server + only the deps actually
  // used, rather than a normal `next build` output that requires `next
  // start` + the full node_modules tree). Without this, `docker compose up
  // --build` produces an image that crash-loops immediately since
  // server.js was never emitted. Local dev (`npm run dev`) is unaffected —
  // this only changes what `next build` produces.
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

module.exports = nextConfig;
