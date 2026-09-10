export const storeUrl = (appId: number) => `https://store.steampowered.com/app/${appId}`

// We store only OpenCritic's numeric score, not its game id/slug, so we can't
// deep-link to the exact game page. Link out to OpenCritic's search by name.
export const openCriticSearchUrl = (name: string) =>
  `https://opencritic.com/search?q=${encodeURIComponent(name)}`

// Steam's CDN serves a header capsule for every app id, so we can always show an
// image even before the collector has enriched header_image. Used as a CSS
// background so a 404 falls back to the colored placeholder block.
export const headerImg = (appId: number, stored?: string | null) =>
  stored || `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`
