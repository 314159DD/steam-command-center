import { neon } from '@neondatabase/serverless'

// Lazy: created per call so `next build` (no DATABASE_URL) doesn't throw at import time.
export const db = () => neon(process.env.DATABASE_URL!)
