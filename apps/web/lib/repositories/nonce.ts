import { randomUUID } from 'crypto'
import { BaseRepository } from './base'
import { isRedisHealthy } from '@/lib/redis'
import { MemoryNonceStore } from './nonce-memory'

/**
 * Nonce states for tracking usage.
 */
export type NonceState = 'pending' | 'used'

/**
 * Generic nonce repository for managing single-use tokens.
 *
 * Used for SIWX authentication and x402 payment verification
 * to prevent replay attacks.
 */
export class NonceRepository extends BaseRepository {
  private readonly ttlSeconds: number
  private memoryStore: MemoryNonceStore | null = null
  private redisChecked = false
  private useMemory = process.env.NONCE_STORE === 'memory'

  constructor(keyPrefix: string, ttlSeconds: number) {
    super(keyPrefix)
    this.ttlSeconds = ttlSeconds
    if (this.useMemory) {
      this.memoryStore = new MemoryNonceStore(keyPrefix)
      console.warn(`[Nonce] Using in-memory store for prefix "${keyPrefix}" (NONCE_STORE=memory)`)
    }
  }

  private allowsMemoryFallback(): boolean {
    if (process.env.NONCE_STORE === 'memory') return true
    if (process.env.NODE_ENV === 'development') return true
    // pnpm start:web runs NODE_ENV=production — still allow local runs without Redis
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) return true
    return false
  }

  private async ensureBackend(): Promise<void> {
    if (this.useMemory || this.redisChecked) return
    this.redisChecked = true

    const healthy = await isRedisHealthy()
    if (healthy) return

    if (this.allowsMemoryFallback()) {
      this.useMemory = true
      this.memoryStore = new MemoryNonceStore(this.keyPrefix)
      console.warn(
        `[Nonce] Redis unavailable at ${process.env.REDIS_URL ?? 'redis://localhost:6379'}; ` +
          `using in-memory nonce store for "${this.keyPrefix}". ` +
          'For production deploys, run Redis or remove localhost from NEXT_PUBLIC_APP_URL.'
      )
      return
    }

    throw new Error(
      'Redis is required for nonce storage. Set REDIS_URL, start Redis, or set NONCE_STORE=memory for local dev.'
    )
  }

  /**
   * Generate a new nonce with the configured TTL.
   */
  async generate(): Promise<string> {
    await this.ensureBackend()

    const nonce = randomUUID()

    if (this.useMemory && this.memoryStore) {
      await this.memoryStore.setPending(nonce, this.ttlSeconds)
      return nonce
    }

    const key = this.buildKey(nonce)
    await this.redis.set(key, 'pending', 'EX', this.ttlSeconds)

    return nonce
  }

  /**
   * Verify and consume a nonce atomically.
   * Returns true if the nonce was valid and unused.
   *
   * This is atomic - the nonce is marked as used in the same operation.
   */
  async consume(nonce: string): Promise<boolean> {
    await this.ensureBackend()

    if (this.useMemory && this.memoryStore) {
      return this.memoryStore.consume(nonce)
    }

    const key = this.buildKey(nonce)

    // Lua script for atomic get-and-set
    const script = `
      local value = redis.call('GET', KEYS[1])
      if value == 'pending' then
        redis.call('SET', KEYS[1], 'used', 'KEEPTTL')
        return 1
      end
      return 0
    `

    const result = await this.redis.eval(script, 1, key)
    return result === 1
  }

  /**
   * Check if a nonce exists and is still valid (without consuming it).
   */
  async isValid(nonce: string): Promise<boolean> {
    await this.ensureBackend()

    if (this.useMemory && this.memoryStore) {
      return (await this.memoryStore.get(nonce)) === 'pending'
    }

    const key = this.buildKey(nonce)
    const value = await this.redis.get(key)
    return value === 'pending'
  }

  /**
   * Check if a nonce has already been used.
   */
  async isUsed(nonce: string): Promise<boolean> {
    await this.ensureBackend()

    if (this.useMemory && this.memoryStore) {
      return (await this.memoryStore.get(nonce)) === 'used'
    }

    const key = this.buildKey(nonce)
    const value = await this.redis.get(key)
    return value === 'used'
  }

  /**
   * Get the current state of a nonce.
   */
  async getState(nonce: string): Promise<NonceState | null> {
    await this.ensureBackend()

    if (this.useMemory && this.memoryStore) {
      return this.memoryStore.get(nonce)
    }

    const key = this.buildKey(nonce)
    const value = await this.redis.get(key)
    return value as NonceState | null
  }

  /**
   * Manually invalidate a nonce (e.g., on logout).
   */
  async invalidate(nonce: string): Promise<boolean> {
    await this.ensureBackend()

    if (this.useMemory && this.memoryStore) {
      return this.memoryStore.del(nonce)
    }

    const key = this.buildKey(nonce)
    const deleted = await this.redis.del(key)
    return deleted > 0
  }

  /**
   * Count active (pending) nonces - useful for monitoring.
   * Note: Uses SCAN which may be slow on large datasets.
   */
  async countActive(): Promise<number> {
    let count = 0
    let cursor = '0'

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${this.keyPrefix}*`,
        'COUNT',
        100
      )
      cursor = nextCursor

      // Check each key's value
      for (const key of keys) {
        const value = await this.redis.get(key)
        if (value === 'pending') count++
      }
    } while (cursor !== '0')

    return count
  }
}
