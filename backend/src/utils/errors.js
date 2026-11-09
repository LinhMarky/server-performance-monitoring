export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let lastLogAt = 0;
export function logError(error) {
  const now = Date.now();
  // Avoid flooding logs during an outage. Never log credentials or request contents.
  if (now - lastLogAt > 30000) {
    console.error(JSON.stringify({ event: 'service_error', code: error.code || 'UNAVAILABLE' }));
    lastLogAt = now;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
  }
  logError(error);
  const unavailable = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    '57P01', '57P02', '57P03', '53300', '57014'].includes(error.code)
    || error.code?.startsWith('08') || /connection|timeout/i.test(error.message || '');
  res.status(unavailable ? 503 : 500).json({
    success: false,
    error: {
      code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
      message: unavailable ? 'Cơ sở dữ liệu tạm thời chưa sẵn sàng. Vui lòng thử lại.' : 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.'
    }
  });
}
