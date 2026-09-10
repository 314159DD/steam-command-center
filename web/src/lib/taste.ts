type LibItem = { app_id: number; playtime_forever: number }
type GameTags = { app_id: number; tags: string[] }
export type TagWeights = Record<string, number>

/** Log-damped, playtime-weighted tag affinity, normalized so max weight = 1. */
export function deriveTagWeights(lib: LibItem[], games: GameTags[]): TagWeights {
  const tagsByApp = new Map(games.map((g) => [g.app_id, g.tags ?? []]))
  const raw: TagWeights = {}
  for (const item of lib) {
    const tags = tagsByApp.get(item.app_id)
    if (!tags) continue
    const weight = 1 + Math.log1p(item.playtime_forever / 60) // hours, damped; +1 floor for owned
    for (const tag of tags) raw[tag] = (raw[tag] ?? 0) + weight
  }
  const max = Math.max(1, ...Object.values(raw))
  const norm: TagWeights = {}
  for (const [tag, v] of Object.entries(raw)) norm[tag] = v / max
  return norm
}

export function tasteScore(tags: string[], weights: TagWeights): number {
  return tags.reduce((sum, t) => sum + (weights[t] ?? 0), 0)
}
