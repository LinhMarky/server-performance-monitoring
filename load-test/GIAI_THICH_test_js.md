# GIẢI THÍCH FILE `test.js`

Tài liệu giải thích file kịch bản tải `test.js` của Đề tài 20: file dùng để làm gì, từng đoạn code làm gì, vì sao viết như vậy, và cách đọc kết quả.

---

## 1. `test.js` là gì, dùng để làm gì?

### 1.1. k6 và `test.js`

- **k6** là một chương trình tạo tải, cài trên máy khách (laptop Windows, `C:\Program Files\k6\k6.exe`). Nó giả lập nhiều người dùng cùng gửi request tới server và đo độ trễ, thông lượng, tỷ lệ lỗi.
- **`test.js`** là **kịch bản** viết bằng JavaScript, cho k6 biết:
  - gọi địa chỉ nào (endpoint nào),
  - bao nhiêu người dùng ảo, trong bao lâu,
  - mỗi người dùng làm gì, nghỉ bao lâu,
  - kiểm tra kết quả đúng hay sai,
  - ghi thêm chỉ số gì.

Hình dung: k6 là trình phát nhạc, `test.js` là bản nhạc. Cài k6 một lần, còn kịch bản thì viết riêng cho từng bài toán.

### 1.2. Vai trò trong đề tài

Đề tài cần chứng minh bằng số liệu rằng server chậm khi nhiều người tra cứu, và chậm ở đâu. `test.js` là **công cụ tạo ra tình huống "nhiều người cùng tra cứu"** một cách **có kiểm soát và lặp lại được**:

- Cùng một kịch bản chạy cho cả **trước** (chưa có index) và **sau** (đã có index), nên phép so sánh công bằng.
- Chỉ đổi số người dùng ảo (`VUS`) là có 3 mức tải 10 / 50 / 200.
- Mọi lần đo trong đề tài đều chạy bằng file này: pilot, 9 lần trước, 9 lần sau, demo.

### 1.3. Nó đo cái gì?

Tác vụ duy nhất được đo:

```
GET /api/students/search?code=SV0150000
```

Đây là API tra cứu sinh viên theo mã, thao tác người dùng hay làm nhất và cũng là chỗ có nút thắt (cột `student_code` chưa có index thì PostgreSQL phải quét cả bảng 200.000 dòng).

---

## 2. Bức tranh tổng thể khi chạy

```
            k6 đọc test.js
                 │
        ┌────────▼────────┐
        │ setup()          │  chạy 1 lần: kiểm tra server sống, ghi giờ bắt đầu
        └────────┬────────┘
                 │
   ┌─────────────▼──────────────┐
   │ N người dùng ảo (VU)        │  mỗi VU lặp lại hàm default():
   │  VU1  VU2  VU3 ... VUn      │   chọn mã → gọi API → kiểm tra → ghi số → nghỉ 1s
   │  30s tăng dần + 120s giữ N  │
   └─────────────┬──────────────┘
                 │
        ┌────────▼────────┐
        │ teardown()       │  chạy 1 lần: in giờ kết thúc
        └────────┬────────┘
                 │
        k6 in bảng tổng kết (và ghi CSV nếu có --out csv=...)
```

---

## 3. Giải thích code từng đoạn

### 3.1. Dòng 1–9: chú thích hướng dẫn

```js
// DE20 - Kịch bản tải k6 cho endpoint chính: GET /api/students/search?code=...
// Chạy:  k6 run -e VUS=50 --out csv=ket_qua_tho/truoc_50vu_lan1_k6.csv test.js
// Tham số (-e):
//   BASE      URL server (mặc định http://3.26.226.194:3000)
//   VUS       số người dùng ảo (bắt buộc giữ nguyên giữa trước/sau)
//   ...
```

Không phải code, chỉ là ghi chú cho người đọc: file đo cái gì, chạy thế nào, có những tham số nào.

- `-e TÊN=giá_trị`: truyền tham số vào kịch bản (biến môi trường).
- `--out csv=...`: ghi toàn bộ số liệu thô ra file CSV để phân tích sau.

### 3.2. Dòng 10–13: nạp thư viện của k6

```js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';
```

| Thư viện | Dùng để |
|---|---|
| `http` | Gửi request HTTP (`http.get(...)`) |
| `check` | Kiểm tra kết quả đúng/sai, k6 đếm tỷ lệ đạt |
| `sleep` | Cho người dùng ảo nghỉ (giả lập người thật đọc kết quả) |
| `SharedArray` | Mảng dữ liệu dùng chung cho mọi VU, tiết kiệm RAM |
| `Trend` | Chỉ số dạng phân bố số (tính được TB, p95, max…) |
| `Rate` | Chỉ số dạng tỷ lệ (bao nhiêu % đúng/sai) |

### 3.3. Dòng 15–20: đọc tham số

```js
const BASE = __ENV.BASE || 'http://3.26.226.194:3000';
const VUS = Number(__ENV.VUS || 10);
const WARMUP = __ENV.WARMUP || '30s';
const DURATION = __ENV.DURATION || '120s';
const SLEEP = Number(__ENV.SLEEP || 1);
const MISS = Number(__ENV.MISS || 0);
```

- `__ENV.X` đọc giá trị truyền bằng `-e X=...`. Nếu không truyền thì lấy giá trị sau `||` (mặc định).
- `Number(...)` đổi chuỗi thành số, vì tham số truyền vào luôn là chuỗi.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `BASE` | `http://3.26.226.194:3000` | Địa chỉ server EC2 |
| `VUS` | 10 | Số người dùng ảo. Đề tài dùng 10 / 50 / 200 |
| `WARMUP` | 30s | Thời gian khởi động, **bị loại khỏi kết quả** |
| `DURATION` | 120s | Thời gian đo chính thức |
| `SLEEP` | 1 | Mỗi VU nghỉ 1 giây giữa 2 lần tra (think time) |
| `MISS` | 0 | Tỷ lệ tra mã không tồn tại (0 = luôn tra mã có thật) |

**Vì sao cần tham số:** cùng một file chạy được mọi mức tải và cả lúc demo (rút ngắn thời gian) mà không phải sửa code. Sửa code giữa trước và sau sẽ làm phép so sánh mất công bằng.

**Vì sao có khởi động (warm-up):** lúc mới bắt đầu, số người dùng đang tăng dần, kết nối mạng đang được mở, cache của database chưa nóng. Số liệu giai đoạn này không ổn định nên bị bỏ. `phan_tich.py` tự cắt 30 giây đầu.

**Vì sao nghỉ 1 giây:** người thật tra xong sẽ đọc kết quả rồi mới tra tiếp. Không có `sleep`, mỗi VU sẽ gửi request liên tục không ngừng, thành bài kiểm tra "dội bom" chứ không giống người dùng thật.

### 3.4. Dòng 22–23: nạp danh sách mã sinh viên

```js
const CODES = new SharedArray('codes', () => JSON.parse(open('./student-codes.json')));
```

- `open('./student-codes.json')`: đọc file chứa **106 mã sinh viên có thật**, rải đều từ `SV0000001` đến `SV0200000`.
- `JSON.parse(...)`: đổi nội dung file thành mảng JavaScript.
- `SharedArray`: chỉ nạp **một bản** dùng chung cho mọi VU. Nếu dùng mảng thường, 200 VU sẽ có 200 bản sao, tốn RAM của máy khách.

**Vì sao 106 mã rải đều cả bảng mà không tra một mã cố định:**
- Truy vấn có `LIMIT 1`. Khi chưa có index, PostgreSQL quét từ đầu bảng và **dừng khi gặp dòng đầu tiên khớp**. Tra `SV0000001` (dòng đầu) thì gần như không phải quét, nhanh **giả tạo**. Tra `SV0199999` (cuối bảng) thì phải quét gần hết.
- Rải đều thì kết quả đại diện cho **trung bình** của mọi vị trí trong bảng.
- Danh sách **giữ nguyên** giữa trước và sau.

### 3.5. Dòng 25–28: khai báo chỉ số riêng

```js
const dbQueryMs = new Trend('db_query_ms', true);
const apiProcMs = new Trend('api_processing_ms', true);
const badBody = new Rate('bad_body');
```

k6 tự đo thời gian **từ laptop tới server và quay về** (`http_req_duration`). Nhưng server ở Sydney, riêng đường mạng VN ↔ Sydney đã mất khoảng 120–230 ms. Con số này không phản ánh tốc độ xử lý của server.

Vì vậy API được thiết kế để **tự báo** thời gian xử lý trong phần `performance` của JSON trả về:

```json
{
  "success": true,
  "data": { "student_code": "SV0199999", "full_name": "Đặng Hải Dũng", ... },
  "performance": { "db_query_ms": 0.579, "api_processing_ms": 0.626 }
}
```

| Chỉ số | Ý nghĩa |
|---|---|
| `db_query_ms` | Thời gian Node.js chờ PostgreSQL trả kết quả truy vấn. **Chỉ số quan trọng nhất của đề tài** |
| `api_processing_ms` | Tổng thời gian server xử lý request (gồm cả `db_query_ms`) |
| `bad_body` | Tỷ lệ request trả về sai (sai mã HTTP hoặc sai dữ liệu) |

Tham số `true` trong `new Trend(..., true)` báo cho k6 đây là **thời gian**, để k6 hiển thị đơn vị ms/µs/s cho dễ đọc.

### 3.6. Dòng 30–44: kịch bản tải (`options`)

```js
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
```

- `executor: 'ramping-vus'`: kiểu kịch bản mà số người dùng ảo thay đổi theo từng giai đoạn.
- `startVUs: 0`: bắt đầu từ 0 người.
- `stages`: các giai đoạn:
  1. Trong `WARMUP` (30s): tăng dần từ 0 lên `VUS` người.
  2. Trong `DURATION` (120s): giữ nguyên `VUS` người. **Đây là giai đoạn lấy số liệu.**
- `gracefulRampDown`, `gracefulStop`: khi hết giờ, cho các request đang chạy dở thêm 5–10 giây để hoàn thành thay vì cắt ngang (tránh lỗi giả).
- `summaryTrendStats`: các thống kê in ra cuối: trung bình, nhỏ nhất, trung vị, p90, p95, p99, lớn nhất.

Hình dạng tải theo thời gian (ví dụ `VUS=50`):

```
 VU
 50 │        ┌──────────────────────────────┐
    │      ╱                                │
    │    ╱                                  │
    │  ╱                                    │
  0 └─┴────────┴──────────────────────────────┴──► thời gian
      0s      30s                           150s
      └ khởi động ┘└────── đo chính thức ──────┘
        (bỏ đi)
```

**p95 là gì:** 95% request nhanh hơn con số này. Trung bình có thể bị kéo lệch, còn p95 cho biết "trường hợp chậm" mà người dùng thường gặp. Đây là chỉ số chuẩn khi đánh giá trải nghiệm.

### 3.7. Dòng 46–50: `setup()`, chạy một lần trước khi đo

```js
export function setup() {
  const r = http.get(`${BASE}/api/health`);
  if (r.status !== 200) throw new Error(`Server không sẵn sàng: HTTP ${r.status}`);
  return { start_epoch: Math.floor(Date.now() / 1000) };
}
```

- Gọi `/api/health` để chắc server và database đang chạy. Nếu không phải HTTP 200 thì **dừng ngay**, tránh đo một server đang hỏng rồi ra số liệu rác.
- Trả về `start_epoch`: thời điểm bắt đầu tính bằng **giây Unix (epoch)**. Giá trị này được truyền sang `teardown()`.
- Request health trong `setup()` **không** tính vào kết quả (`phan_tich.py` lọc bỏ nhóm `::setup`).

**Vì sao cần epoch:** `monitor.sh` trên server cũng ghi CPU/RAM theo epoch. Cùng một thang thời gian thì ghép được "giây thứ X, k6 thấy độ trễ Y, server có CPU Z". Đây là yêu cầu của **KT2** (số liệu tải và tài nguyên đồng bộ thời gian).

### 3.8. Dòng 52–78: hàm chính, việc mỗi người dùng ảo lặp lại

Mỗi VU chạy hàm này **liên tục từ đầu đến cuối** thời gian đo. Mỗi lần chạy hết hàm gọi là một **iteration** (vòng lặp).

#### Bước 1: chọn mã cần tra (dòng 53–54)

```js
const miss = Math.random() < MISS;
const code = miss ? 'SV9999999' : CODES[Math.floor(Math.random() * CODES.length)];
```

- `Math.random()` cho số ngẫu nhiên từ 0 đến 1. Với `MISS = 0` thì `miss` luôn là `false`, tức luôn tra mã có thật.
- `CODES[Math.floor(Math.random() * CODES.length)]`: chọn ngẫu nhiên một trong 106 mã.
- Nếu đặt `MISS = 0.1` thì khoảng 10% lần tra dùng `SV9999999`, mã không tồn tại, để đo trường hợp "không tìm thấy". Đề tài không dùng (MISS = 0).

#### Bước 2: gọi API (dòng 55–60)

```js
const res = http.get(`${BASE}/api/students/search?code=${code}`, {
  tags: { name: 'search', kind: miss ? 'miss' : 'hit' },
  timeout: '30s',
  responseCallback: http.expectedStatuses(200, 404),
});
```

- Gửi `GET` tới API tra cứu với mã vừa chọn.
- `tags`: gắn nhãn cho request. `name: 'search'` gom mọi request (dù mã khác nhau) thành một nhóm. `phan_tich.py` dựa vào nhãn này để tìm thời điểm bắt đầu đo.
- `timeout: '30s'`: chờ tối đa 30 giây, quá thì tính là lỗi.
- `responseCallback`: báo cho k6 biết HTTP 200 và 404 đều là **phản hồi hợp lệ**. 404 xảy ra khi tra mã không tồn tại, đó là câu trả lời đúng chứ không phải lỗi server. Mã khác (500, 503, timeout) mới tính vào `http_req_failed`.

#### Bước 3: đọc JSON trả về (dòng 62–63)

```js
let body = null;
try { body = res.json(); } catch (_) { /* body không phải JSON */ }
```

Đổi nội dung trả về thành object. Đặt trong `try/catch` vì nếu server lỗi và trả về trang HTML hoặc rỗng, `res.json()` sẽ báo lỗi. Bắt lại để kịch bản không bị dừng, `body` giữ là `null`.

#### Bước 4: kiểm tra kết quả đúng (dòng 65–71)

```js
const ok = check(res, {
  'status đúng': (r) => r.status === (miss ? 404 : 200),
  'dữ liệu đúng mã': () =>
    miss ? body && body.success === false
         : body && body.success === true && body.data && body.data.student_code === code,
});
badBody.add(!ok);
```

Hai điều kiện được kiểm tra cho **mỗi** request:

1. **`status đúng`:** tra mã có thật thì phải HTTP 200, tra mã không tồn tại thì phải 404.
2. **`dữ liệu đúng mã`:** với mã có thật, JSON phải có `success: true` và `data.student_code` **trùng đúng mã đã gửi**.

**Vì sao phải kiểm tra dữ liệu chứ không chỉ đo tốc độ:** một server trả lời nhanh nhưng **sai** thì vô nghĩa. Kiểm tra này đảm bảo sau khi tạo index, kết quả trả về vẫn đúng như trước. Đây là phần "chức năng không đổi" của **KT3**.

- `check(...)` trả về `true` nếu mọi điều kiện đạt. k6 tổng hợp thành dòng `checks_succeeded` ở cuối.
- `badBody.add(!ok)`: ghi vào chỉ số `bad_body` (sai thì ghi 1, đúng thì ghi 0).

#### Bước 5: ghi thời gian server tự báo (dòng 73–76)

```js
if (body && body.performance) {
  dbQueryMs.add(body.performance.db_query_ms);
  apiProcMs.add(body.performance.api_processing_ms);
}
```

Lấy `db_query_ms` và `api_processing_ms` từ JSON, đưa vào hai chỉ số đã khai báo ở mục 3.5. Cuối lần đo k6 sẽ tính TB, p95… cho chúng như mọi chỉ số khác.

#### Bước 6: nghỉ (dòng 77)

```js
sleep(SLEEP);
```

Nghỉ 1 giây (think time) rồi quay lại Bước 1.

### 3.9. Dòng 80–82: `teardown()`, chạy một lần sau khi đo

```js
export function teardown(data) {
  console.log(`epoch bat dau=${data.start_epoch} ket thuc=${Math.floor(Date.now() / 1000)}`);
}
```

- `data` chính là object `setup()` trả về.
- In thời điểm bắt đầu và kết thúc (epoch) để đối chiếu với file `monitor.sh` và `nhat_ky_do.csv`.

---

## 4. Cách chạy

### 4.1. Chạy tay (lúc demo, thử nhanh)

Mở PowerShell ở thư mục `DE20_kiem_thu_tai`:

```powershell
k6 run -e VUS=200 -e WARMUP=10s -e DURATION=60s test.js
```

Không có `--out csv` nên không ghi file, chỉ in kết quả ra màn hình.

### 4.2. Đo chính thức (qua `chay_do.ps1`)

```powershell
.\chay_do.ps1 -TrangThai truoc -VUS 50 -Lan 1
```

`chay_do.ps1` sẽ:
1. kiểm tra server sống,
2. gọi `k6 run ... --out csv=ket_qua_tho\truoc_50vu_lan1_k6.csv test.js`,
3. lưu log, ghi một dòng vào `nhat_ky_do.csv`.

Sau đó `phan_tich.py` đọc các file CSV này để tính thống kê.

---

## 5. Đọc kết quả k6 in ra

Ví dụ thật: lần `truoc_200vu_lan1` (chưa có index) và `sau_200vu_lan1` (đã có index), ngày 19/11/2026.

| Dòng k6 in ra | Ý nghĩa | Trước | Sau |
|---|---|---|---|
| `checks_succeeded` | % kiểm tra đạt (mỗi request có 2 kiểm tra) | 100% | 100% |
| `http_reqs` | Tổng số request và **thông lượng** (request/giây) | 8.791, **57/s** | 22.760, **150/s** |
| `http_req_failed` | % request lỗi (không phải 200/404, timeout) | 0% | 0% |
| `http_req_duration` | **Độ trễ** từ laptop tới server và về (gồm cả mạng) | TB 2,09 s | TB 188 ms |
| `db_query_ms` | Thời gian database xử lý (server tự báo) | TB **1,8 s** | TB **3,6 ms** |
| `iteration_duration` | Thời gian một vòng của VU (= độ trễ + 1s nghỉ) | khoảng 3,1 s | khoảng 1,2 s |
| `vus` | Số người dùng ảo đang chạy | tới 200 | tới 200 |

### Vì sao thông lượng lại như vậy?

Mỗi VU làm một vòng = **thời gian chờ server trả lời + 1 giây nghỉ**. Nên:

```
thông lượng ≈ số VU / (độ trễ + thời gian nghỉ)
```

- **Trước:** 200 / (2,1 + 1) ≈ 64 req/s, đo thực tế được **57 req/s**. Server chậm làm mỗi VU phải chờ lâu, nên thông lượng bị kéo xuống.
- **Sau:** 200 / (0,19 + 1) ≈ 168 req/s, đo thực tế được **150 req/s**. Server trả lời nhanh nên VU quay vòng nhanh, gần mức tối đa lý thuyết là 200 req/s.

### Cách nhìn `http_req_duration` và `db_query_ms` cùng nhau

| Trường hợp | Ý nghĩa |
|---|---|
| `http_req_duration` cao, `db_query_ms` cũng cao | Server/database chậm (đúng tình trạng "trước") |
| `http_req_duration` cao, `db_query_ms` thấp | Chậm do **mạng** hoặc phía máy khách, không phải server |
| Cả hai đều thấp | Hệ thống khỏe |

Trường hợp thứ hai đã thực sự xảy ra ở lần `sau_50vu_lan2`: độ trễ lên tới 30s và có lỗi, trong khi `db_query_ms` chỉ 1,6 ms và CPU server rảnh. Kết luận: lỗi do mạng của laptop, nên lần đo đó bị loại và đo lại.

---

## 6. Những điều phải giữ nguyên giữa trước và sau

Để so sánh công bằng, **không được thay đổi** giữa 9 lần trước và 9 lần sau:

- nội dung `test.js` (không sửa code),
- file `student-codes.json` (106 mã),
- `VUS` từng mức (10 / 50 / 200), `WARMUP` 30s, `DURATION` 120s, `SLEEP` 1s, `MISS` 0,
- máy khách chạy k6 (cùng laptop, cùng mạng nếu có thể).

**Chỉ một thứ thay đổi:** index `idx_students_code` trên server.

---

## 7. Câu hỏi thầy có thể hỏi về `test.js`

**Hỏi: Vì sao không tra một mã cố định cho đơn giản?**
Đáp: truy vấn có `LIMIT 1`. Không có index thì PostgreSQL quét từ đầu bảng và dừng khi gặp dòng khớp, nên mã đầu bảng nhanh giả tạo, mã cuối bảng thì chậm nhất. 106 mã rải đều cho kết quả đại diện cả bảng.

**Hỏi: Vì sao có `sleep(1)`?**
Đáp: giả lập người dùng thật, tra xong đọc kết quả rồi mới tra tiếp. Không có nghỉ thì thành bài kiểm tra "dội bom", không phản ánh tình huống thật.

**Hỏi: Vì sao bỏ 30 giây đầu?**
Đáp: lúc đó số VU đang tăng, kết nối đang mở, cache database chưa nóng. Số liệu chưa ổn định nên không đưa vào phân tích.

**Hỏi: Vì sao cần `db_query_ms` khi k6 đã đo độ trễ?**
Đáp: độ trễ k6 đo gồm khoảng 120–230 ms đường mạng VN ↔ Sydney. `db_query_ms` do server tự đo, tách riêng phần database xử lý, cho thấy đúng chỗ index tác động.

**Hỏi: Làm sao biết sau khi tạo index kết quả vẫn đúng?**
Đáp: mỗi request đều có `check` so `data.student_code` với mã đã gửi. Cả trước và sau đều đạt 100%. Thêm vào đó, KT1 chạy `functional-check.sh` trước và sau đều đạt 8/8.

**Hỏi: 404 có bị tính là lỗi không?**
Đáp: không. `responseCallback: http.expectedStatuses(200, 404)` khai báo 404 (mã không tồn tại) là câu trả lời hợp lệ. Chỉ lỗi server (5xx) và timeout mới tính vào `http_req_failed`.
