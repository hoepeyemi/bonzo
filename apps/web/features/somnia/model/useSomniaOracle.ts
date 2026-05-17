'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface OracleFeedSnapshot {
  label: string
  labelHash: string
  decimals: number
  url: string
  jsonSelector: string
  value: string
  valueFormatted: string
  requestId: string
  hasValue: boolean
  bridgeAddress: string
  explorerBaseUrl: string
}

interface OracleListResponse {
  configured: Array<{
    label: string
    url: string
    jsonSelector: string
    decimals: number
  }>
  feeds: OracleFeedSnapshot[]
}

interface OracleRefreshResponse {
  success: boolean
  snapshot: OracleFeedSnapshot
  submitTxHash: string
  explorerTxUrl: string
  depositStt: string
  error?: string
}

async function fetchOracleFeeds(): Promise<OracleListResponse> {
  const res = await fetch('/api/somnia/oracle')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to load oracle feeds')
  }
  return res.json()
}

async function refreshOracle(label?: string): Promise<OracleRefreshResponse> {
  const res = await fetch('/api/somnia/oracle/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(label ? { label } : {}),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to refresh oracle')
  }
  return data
}

export function useSomniaOracle() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['somnia-oracle'],
    queryFn: fetchOracleFeeds,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const refreshMutation = useMutation({
    mutationFn: (label?: string) => refreshOracle(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['somnia-oracle'] })
    },
  })

  return {
    configured: query.data?.configured ?? [],
    feeds: query.data?.feeds ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    refresh: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    lastRefresh: refreshMutation.data,
    refreshError: refreshMutation.error,
  }
}
