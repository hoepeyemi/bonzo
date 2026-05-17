import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import type { User } from '@/lib/db/schema'

export type OracleRefreshPrincipal = User | 'api-key'

/**
 * Paid oracle refresh requires a signed-in user OR a valid SOMNIA_ORACLE_API_KEY.
 * Header: Authorization: Bearer <key>  or  x-somnia-oracle-api-key: <key>
 */
export async function requireOracleRefreshAuth(
  request: NextRequest
): Promise<OracleRefreshPrincipal | NextResponse> {
  const expected = process.env.SOMNIA_ORACLE_API_KEY?.trim()
  if (expected) {
    const authHeader = request.headers.get('authorization')
    const bearer =
      authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
    const headerKey = request.headers.get('x-somnia-oracle-api-key')?.trim()
    if (bearer === expected || headerKey === expected) {
      return 'api-key'
    }
  }

  const user = await getCurrentUser()
  if (user) return user

  return NextResponse.json(
    {
      error:
        'Unauthorized. Sign in or send SOMNIA_ORACLE_API_KEY via Authorization: Bearer or x-somnia-oracle-api-key.',
    },
    { status: 401 }
  )
}
