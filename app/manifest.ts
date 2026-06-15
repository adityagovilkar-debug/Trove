import type { MetadataRoute } from "next";

// PWA manifest — makes Larder installable to the desktop taskbar / dock and
// the phone home screen. Served at /manifest.webmanifest automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trove — Home Inventory",
    short_name: "Trove",
    description:
      "Track everything you own, what's expiring, and what to rebuy.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d0c",
    theme_color: "#ed8c0f",
    orientation: "portrait-primary",
    categories: ["productivity", "lifestyle", "utilities"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
