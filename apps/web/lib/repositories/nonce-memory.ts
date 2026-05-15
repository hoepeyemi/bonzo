import type { NonceState } from './nonce'

interface MemoryEntry {
  state: NonceState
  expiresAt: number
}

/**
 * In-process nonce store for local development when Redis is unavailable.
 * Not suitable for production (no sharing across instances, lost on restart).
 */
export class MemoryNonceStore {
  private readonly entries = new Map<string, MemoryEntry>()

  constructor(private readonly keyPrefix: string) {}

  private key(nonce: string): string {
    return `${this.keyPrefix}${nonce}`
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [k, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(k)
      }
    }
  }

  async setPending(nonce: string, ttlSeconds: number): Promise<void> {
    this.pruneExpired()
    this.entries.set(this.key(nonce), {
      state: 'pending',
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  async get(nonce: string): Promise<NonceState | null> {
    this.pruneExpired()
    const entry = this.entries.get(this.key(nonce))
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(this.key(nonce))
      return null
    }
    return entry.state
  }

  async consume(nonce: string): Promise<boolean> {
    this.pruneExpired()
    const k = this.key(nonce)
    const entry = this.entries.get(k)
    if (!entry || entry.expiresAt <= Date.now()) {
      this.entries.delete(k)
      return false
    }
    if (entry.state !== 'pending') {
      return false
    }
    entry.state = 'used'
    return true
  }

  async del(nonce: string): Promise<boolean> {
    return this.entries.delete(this.key(nonce))
  }
}
