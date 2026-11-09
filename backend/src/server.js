import { readConfig } from './config/index.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const config = readConfig();
const pool = createPool(config.database);
const server = createApp(pool).listen(config.port, '0.0.0.0', () => {
  console.info(`Student Academic Management: http://localhost:${config.port}`);
});
server.on('error', error => { console.error(error.code || 'SERVER_ERROR'); process.exit(1); });
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(async () => { await pool.end(); process.exit(0); });
  // A shutdown deadline, never an artificial request delay.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
