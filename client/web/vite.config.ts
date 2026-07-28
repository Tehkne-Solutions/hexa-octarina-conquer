import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/icon-192.svg", "icons/icon-512.svg"],
      manifest: {
        name: "Hexa Octarina Conquer",
        short_name: "Hexa Octarina",
        description: "Jogo tático territorial online da Tehkné Solutions.",
        theme_color: "#11120f",
        background_color: "#11120f",
        display: "standalone",
        orientation: "any",
        scope: "/",
        start_url: "/",
        categories: ["games", "strategy"],
        prefer_related_applications: false,
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/(?:campaign|ws)(?:\/|$)/],
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,json,svg,png,webp,woff2}"],
        globIgnores: [
          "assets/progressive/**/*",
          "assets/runtime/packages/**/*",
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.method === "GET"
              && url.pathname === "/campaign/catalog"
              && !request.headers.has("authorization")
              && !request.headers.has("x-account-id"),
            handler: "NetworkFirst",
            options: {
              cacheName: "hexa-guest-campaign-catalog",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ request, url }) => request.method === "GET"
              && url.pathname.startsWith("/assets/runtime/packages/"),
            handler: "CacheFirst",
            options: {
              cacheName: "hexa-pack99-runtime",
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 256,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: ({ request, url }) => request.method === "GET"
              && url.pathname.startsWith("/assets/progressive/PACK_01_TERRAIN_CORE/"),
            handler: "CacheFirst",
            options: {
              cacheName: "hexa-pack01-terrain",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 160, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: ({ request, url }) => request.method === "GET"
              && url.pathname.startsWith("/assets/progressive/PACK_02_BOARD_SYSTEM/"),
            handler: "CacheFirst",
            options: {
              cacheName: "hexa-pack02-board",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 180, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "hexa-images",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "hexa-fonts",
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
  },
  server: {
    port: 4173,
  },
});
