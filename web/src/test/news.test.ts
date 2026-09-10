import { describe, it, expect } from 'vitest'
import { classify, stripBbcode, parseNewsItems } from '@/lib/news'

describe('classify', () => {
  it('returns HOTFIX for crash/emergency fixes (highest precedence)', () => {
    expect(classify('Emergency Hotfix', 'quick fix for the crash')).toBe('HOTFIX')
    expect(classify('Patch 1.0 hotfix', 'major update and crash fix')).toBe('HOTFIX')
  })
  it('returns MAJOR for v1.0 / out of early access / seasons', () => {
    expect(classify('Out of Early Access!', 'full release')).toBe('MAJOR')
    expect(classify('Update v2.0', '')).toBe('MAJOR')
    expect(classify('Season 4 begins', '')).toBe('MAJOR')
  })
  it('returns CONTENT for new maps/heroes/dlc', () => {
    expect(classify('New map added', 'adds 3 new heroes')).toBe('CONTENT')
  })
  it('defaults to UPDATE', () => {
    expect(classify('Weekly patch notes', 'balance tweaks')).toBe('UPDATE')
  })
})

describe('stripBbcode', () => {
  it('removes image tags with content and other bbcode, collapses whitespace', () => {
    expect(stripBbcode('[img]http://x/y.png[/img][b]Hello[/b]   world\n\nthere'))
      .toBe('Hello world there')
  })
  it('strips raw HTML tags but keeps their text', () => {
    expect(stripBbcode('<strong>Hello</strong> <a href="z">world</a>')).toBe('Hello world')
  })
  it('removes {STEAM_CLAN_IMAGE} tokens and their attached path', () => {
    expect(stripBbcode('{STEAM_CLAN_IMAGE}/40085203/abc123.png Patch is live')).toBe('Patch is live')
  })
  it('decodes common HTML entities', () => {
    expect(stripBbcode('Steam &amp; chill &#39;n&#39; &quot;play&quot;')).toBe(`Steam & chill 'n' "play"`)
  })
})

describe('parseNewsItems', () => {
  it('maps Steam newsitems into classified update rows', () => {
    const payload = { appnews: { newsitems: [
      { gid: 'g1', title: 'Out of Early Access', contents: '[b]full release[/b] now', url: 'http://u', date: 1700000000 },
    ]}}
    const rows = parseNewsItems(payload, 570)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      gid: 'g1', app_id: 570, title: 'Out of Early Access',
      body: 'full release now', url: 'http://u', classification: 'MAJOR',
    })
    expect(rows[0].posted_at).toBe(new Date(1700000000 * 1000).toISOString())
  })
  it('returns [] when there are no news items', () => {
    expect(parseNewsItems({ appnews: { newsitems: [] } }, 1)).toEqual([])
    expect(parseNewsItems({}, 1)).toEqual([])
  })
})
