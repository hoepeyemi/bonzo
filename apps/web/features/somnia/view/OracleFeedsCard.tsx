'use client'

import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSomniaOracle } from '../model/useSomniaOracle'

export function OracleFeedsCard() {
  const {
    feeds,
    configured,
    isLoading,
    error,
    refresh,
    isRefreshing,
    lastRefresh,
    refreshError,
  } = useSomniaOracle()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Somnia Oracle</CardTitle>
          <CardDescription>On-chain feeds via Somnia Agents</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Somnia Oracle</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load oracle'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Set SOMNIA_ORACLE_URL and SOMNIA_ORACLE_SELECTOR in apps/web/.env.local
          </p>
        </CardContent>
      </Card>
    )
  }

  if (configured.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Somnia Oracle</CardTitle>
          <CardDescription>On-chain JSON API feeds</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No feeds configured. Add SOMNIA_ORACLE_URL, SOMNIA_ORACLE_SELECTOR, and
            SOMNIA_ORACLE_LABEL to .env.local (see hardhat/.env).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <motionless>
          <CardTitle>Somnia Oracle</CardTitle>
          <CardDescription>
            Verified off-chain data on Somnia testnet (~0.12 STT per refresh)
          </CardDescription>
        </motionless>
        <Button
          size="sm"
          variant="outline"
          disabled={isRefreshing}
          onClick={() => refresh(feeds[0]?.label)}
        >
          {isRefreshing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {refreshError && (
          <p className="text-sm text-destructive">
            {refreshError instanceof Error ? refreshError.message : 'Refresh failed'}
          </p>
        )}
        {lastRefresh?.explorerTxUrl && (
          <p className="text-xs text-muted-foreground">
            Last refresh:{' '}
            <a
              href={lastRefresh.explorerTxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              tx <ExternalLink className="size-3" />
            </a>
            {' · '}
            paid {lastRefresh.depositStt} STT
          </p>
        )}
        <div className="space-y-3">
          {feeds.map((feed) => (
            <motionless
              key={feed.label}
              className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <motionless>
                <motionless className="flex items-center gap-2">
                  <span className="font-medium">{feed.label}</span>
                  <Badge variant={feed.hasValue ? 'default' : 'secondary'}>
                    {feed.hasValue ? 'live' : 'empty'}
                  </Badge>
                </motionless>
                <p className="text-2xl font-semibold tabular-nums mt-1">
                  {feed.hasValue ? feed.valueFormatted : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                  {feed.jsonSelector} · request #{feed.requestId || '—'}
                </p>
              </motionless>
              <motionless className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isRefreshing}
                  onClick={() => refresh(feed.label)}
                >
                  Update
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a
                    href={`${feed.explorerBaseUrl}/address/${feed.bridgeAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bridge
                  </a>
                </Button>
              </motionless>
            </motionless>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
