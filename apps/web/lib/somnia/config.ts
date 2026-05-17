export interface SomniaOracleFeedConfig {
  label: string
  url: string
  jsonSelector: string
  decimals: number
}

/** Default feed from server env (mirrors hardhat/.env). */
export function getDefaultOracleFeed(): SomniaOracleFeedConfig | null {
  const url = process.env.SOMNIA_ORACLE_URL?.trim()
  const jsonSelector = process.env.SOMNIA_ORACLE_SELECTOR?.trim()
  if (!url || !jsonSelector) return null

  return {
    label: process.env.SOMNIA_ORACLE_LABEL?.trim() || 'btc-usd',
    url,
    jsonSelector,
    decimals: Number(process.env.SOMNIA_ORACLE_DECIMALS ?? '8'),
  }
}

export function getConfiguredOracleFeeds(): SomniaOracleFeedConfig[] {
  const feeds: SomniaOracleFeedConfig[] = []
  const defaultFeed = getDefaultOracleFeed()
  if (defaultFeed) feeds.push(defaultFeed)

  const raw = process.env.SOMNIA_ORACLE_FEEDS?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SomniaOracleFeedConfig[]
      for (const feed of parsed) {
        if (feed?.label && feed?.url && feed?.jsonSelector) {
          feeds.push({
            label: feed.label,
            url: feed.url,
            jsonSelector: feed.jsonSelector,
            decimals: feed.decimals ?? 8,
          })
        }
      }
    } catch {
      console.warn('[somnia] Invalid SOMNIA_ORACLE_FEEDS JSON')
    }
  }

  const seen = new Set<string>()
  return feeds.filter((f) => {
    if (seen.has(f.label)) return false
    seen.add(f.label)
    return true
  })
}
