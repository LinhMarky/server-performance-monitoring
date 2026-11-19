// DE20 - Kịch bản tải k6 cho endpoint chính: GET /api/students/search?code=...
// Chạy:  k6 run -e VUS=50 --out csv=ket_qua_tho/truoc_50vu_lan1_k6.csv test.js
// Tham số (-e):
//   BASE      URL server (mặc định http://3.26.226.194:3000)
//   VUS       số người dùng ảo (bắt buộc giữ nguyên giữa trước/sau)
//   WARMUP    thời gian khởi động, KHÔNG tính kết quả (mặc định 30s)
//   DURATION  thời gian đo chính thức (mặc định 120s)
//   SLEEP     think time giữa 2 request của 1 VU, giây (mặc định 1)
//   MISS      tỷ lệ mã không tồn tại 0..1 (mặc định 0; giữ nguyên trước/sau)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://3.26.226.194:3000';
const VUS = Number(__ENV.VUS || 10);
const WARMUP = __ENV.WARMUP || '30s';
const DURATION = __ENV.DURATION || '120s';
const SLEEP = Number(__ENV.SLEEP || 1);
const MISS = Number(__ENV.MISS || 0);

// 106 mã có thật, phân bố đều từ SV0000001 đến SV0200000 (lấy từ repo, không đổi trước/sau)
const CODES = new SharedArray('codes', () => JSON.parse(open('./student-codes.json')));

// Thời gian phía server do API tự báo (tách khỏi độ trễ mạng VN <-> Sydney)
const dbQueryMs = new Trend('db_query_ms', true);
const apiProcMs = new Trend('api_processing_ms', true);
const badBody = new Rate('bad_body');

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: WARMUP, target: VUS },   // khởi động (loại khỏi phân tích)
        { duration: DURATION, target: VUS }, // giai đoạn đo
      ],
      gracefulRampDown: '5s',
      gracefulStop: '10s',
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const r = http.get(`${BASE}/api/health`);
  if (r.status !== 200) throw new Error(`Server không sẵn sàng: HTTP ${r.status}`);
  return { start_epoch: Math.floor(Date.now() / 1000) };
}

export default function () {
  const miss = Math.random() < MISS;
  const code = miss ? 'SV9999999' : CODES[Math.floor(Math.random() * CODES.length)];
  const res = http.get(`${BASE}/api/students/search?code=${code}`, {
    tags: { name: 'search', kind: miss ? 'miss' : 'hit' },
    timeout: '30s',
    // 404 của mã không tồn tại là kết quả đúng, không tính là lỗi
    responseCallback: http.expectedStatuses(200, 404),
  });

  let body = null;
  try { body = res.json(); } catch (_) { /* body không phải JSON */ }

  const ok = check(res, {
    'status đúng': (r) => r.status === (miss ? 404 : 200),
    'dữ liệu đúng mã': () =>
      miss ? body && body.success === false
           : body && body.success === true && body.data && body.data.student_code === code,
  });
  badBody.add(!ok);

  if (body && body.performance) {
    dbQueryMs.add(body.performance.db_query_ms);
    apiProcMs.add(body.performance.api_processing_ms);
  }
  sleep(SLEEP);
}

export function teardown(data) {
  console.log(`epoch bat dau=${data.start_epoch} ket thuc=${Math.floor(Date.now() / 1000)}`);
}
