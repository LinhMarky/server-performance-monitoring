function integer(name, fallback, min, max) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

export function readConfig() {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password || password === 'CHANGE_ME_TO_A_STRONG_PASSWORD') {
    throw new Error('Set POSTGRES_PASSWORD to a private password before starting.');
  }
  return {
    port: integer('PORT', 3000, 1, 65535),
    database: {
      host: process.env.DB_HOST || 'db',
      port: integer('DB_PORT', 5432, 1, 65535),
      database: process.env.POSTGRES_DB || 'student_performance',
      user: process.env.POSTGRES_USER || 'student_app',
      password,
      max: integer('DB_POOL_MAX', 10, 1, 200),
      connectionTimeoutMillis: integer('DB_CONNECT_TIMEOUT_MS', 5000, 100, 120000),
      idleTimeoutMillis: 30000,
      statement_timeout: integer('DB_STATEMENT_TIMEOUT_MS', 15000, 100, 120000),
      application_name: 'student-academic-web'
    }
  };
}
