/**
 * inject-bundle.ts
 * 
 * Importable function to inject bundleIds into the bundle-state-sync database
 * for immediate Worker 1 WebSocket tracking.
 * 
 * Usage from your submit scripts:
 * 
 *   import { injectBundle, closeInjector } from '../../bundle-state-sync/src/inject-bundle';
 * 
 *   const response = await submitBundle(payload);
 *   await injectBundle(response.bundleId);
 *   await closeInjector();
 */

import pg from 'pg';

const DATABASE_URL = process.env.PRODUCER_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? 'postgresql://bundlesync:bundlesync@localhost:5432/bundlesync';

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export async function injectBundle(bundleId: string): Promise<'injected' | 'exists'> {
  const p = getPool();

  const result = await p.query(
    `INSERT INTO bundles (bundle_id, status, raw_payload, first_seen_source, created_at, updated_at, synced_at)
     VALUES ($1, 'created', '{}', 'injected', NOW(), NOW(), NOW())
     ON CONFLICT (bundle_id) DO NOTHING
     RETURNING bundle_id`,
    [bundleId]
  );

  const status = result.rowCount === 1 ? 'injected' : 'exists';
  console.log(`[inject-bundle] ${status}: ${bundleId}`);
  return status;
}

export async function injectBundles(bundleIds: string[]): Promise<void> {
  for (const id of bundleIds) {
    await injectBundle(id);
  }
}

export async function closeInjector(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}