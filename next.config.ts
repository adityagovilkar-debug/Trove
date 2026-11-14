import type { NextConfig } from "next";

// Addresses retired in the 2026-11 rework keep working: old bookmarks and
// cached links on an installed phone land on the screen that replaced them.
// Temporary (307) so a later change of mind isn't cached by browsers forever.
const moved: [string, string][] = [
  ["/inventory", "/stuff?kind=food"],
  ["/things", "/stuff?kind=things"],
  ["/fixit", "/"],
  ["/home", "/"],
  ["/recipes", "/"],
  ["/recipes/:id", "/"],
  ["/subscriptions", "/"],
  ["/plans", "/"],
  ["/trends", "/"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return moved.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
