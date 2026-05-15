import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Match Next.js: .env then .env.local (local overrides)
config({ path: '.env' })
config({ path: '.env.local', override: true })

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
