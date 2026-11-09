import pg from 'pg';
import { logError } from './utils/errors.js';

export function createPool(config) {
  const pool = new pg.Pool(config);
  // Idle connection errors must not terminate the HTTP server. pg replaces dead clients.
  pool.on('error', logError);
  return pool;
}
