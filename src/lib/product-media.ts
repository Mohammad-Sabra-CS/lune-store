/** Upgrade original bundled images only; preserve admin-uploaded URLs.
 * Blue/burgundy photos show shared packaging, not new fragrance identities. */
const replacements: Record<string, string> = {
  "/products/apollo-box.jpg": "/products/lune-men-set-lounge.png",
  "/products/orion-box.jpg": "/products/lune-men-set-moonlight.png",
  "/products/elysia-box.jpg": "/products/lune-women-set-portrait.png",
  "/products/aurora-box.jpg": "/products/lune-women-set-wide.png",
  "/products/set-men.jpg": "/products/lune-men-set-moonlight.png",
  "/products/set-women.jpg": "/products/lune-women-set-wide.png",
};
export function resolveProductImage(src: string): string {
  return replacements[src] ?? src;
}
export function resolveProductGallery(gallery: string[]): string[] {
  return [...new Set(gallery.map(resolveProductImage))];
}
