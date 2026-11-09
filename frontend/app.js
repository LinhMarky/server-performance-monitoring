'use strict';

const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  search: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  book: '<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m4 0h2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5m10-4a8 8 0 0 0-13-3L4 8m16 8-2 3A8 8 0 0 1 5 16"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => new Intl.NumberFormat('vi-VN').format(value);
const score = value => Number(value).toFixed(2);
const initials = name => name.split(' ').slice(-2).map(part => part[0]).join('');
const main = document.querySelector('#main');
const navItems = [['overview', 'grid', 'Tổng quan'], ['students', 'users', 'Danh sách sinh viên'], ['search', 'search', 'Tra cứu sinh viên'], ['transcript', 'file', 'Bảng điểm']];
document.querySelector('#navigation').innerHTML = navItems.map(([id, svg, label]) => `<a class="nav-link" href="#${id}" data-nav="${id}">${icon(svg)}<span>${label}</span></a>`).join('');
let viewController;
let statsData;

function loading(label = 'Đang tải dữ liệu…') { return `<div class="loading" role="status"><span class="spinner" aria-hidden="true"></span>${label}</div>`; }
function empty(title, message, svg = 'search') { return `<div class="empty-state" role="status">${icon(svg)}<h3>${title}</h3><p>${message}</p></div>`; }
function showError(target, error) {
  if (error.name === 'AbortError') return;
  target.innerHTML = `<div class="error-state" role="alert"><h3>Chưa thể tải dữ liệu</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-secondary btn-small" data-action="retry">${icon('refresh')}Thử lại</button></div>`;
}
async function api(path, signal) {
  const started = performance.now();
  const response = await fetch(path, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  const body = await response.json();
  const browserMs = performance.now() - started;
  if (!response.ok && response.status !== 404) throw new Error(body.error?.message || 'Kết nối tạm thời gián đoạn. Vui lòng thử lại.');
  return { body, status: response.status, browserMs };
}
function heading(title, description) {
  const date = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return `<div class="page-heading"><div><div class="eyebrow">CỔNG HỌC VỤ / ${escapeHtml(title)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="date-pill">${icon('calendar')} ${date}</div></div>`;
}
function searchForm(destination = 'search', code = '') {
  return `<form class="search-form" data-destination="${destination}"><label for="student-code">Mã sinh viên</label><div class="input-row"><div class="input-wrap">${icon('search')}<input id="student-code" name="code" type="text" placeholder="Nhập mã sinh viên…" value="${escapeHtml(code)}" autocomplete="off" autocapitalize="characters" spellcheck="false" required pattern="SV[0-9]{7}" maxlength="9" title="Mã gồm SV và 7 chữ số, ví dụ SV0000001" aria-describedby="code-hint"></div><button class="btn btn-primary" type="submit">${icon('search')}Tra cứu</button></div><p class="input-hint" id="code-hint">Nhập đầy đủ mã, gồm SV và 7 chữ số.</p></form>`;
}
function examples() {
  return `<div class="quick-examples"><span>Thử tra cứu:</span>${['SV0000001','SV0000050','SV0000100'].map(code => `<a class="code-chip" href="#search?code=${code}">${code}</a>`).join('')}</div>`;
}
function studentRows(students, compact = false, offset = 0) {
  return students.map((student, i) => `<tr>${compact ? '' : `<td class="mono">${number(offset + i + 1)}</td><td><a class="code-link mono" href="#search?code=${student.student_code}">${escapeHtml(student.student_code)}</a></td>`}<td><div class="student-name-cell"><span class="initials" aria-hidden="true">${escapeHtml(initials(student.full_name))}</span><div><div class="student-name">${escapeHtml(student.full_name)}</div>${compact ? `<div class="student-code mono">${escapeHtml(student.student_code)}</div>` : ''}</div></div></td><td><span class="class-badge">${escapeHtml(student.class_name)}</span></td>${compact ? '' : `<td>${escapeHtml(student.major)}</td><td class="mono">${student.enrollment_year}</td><td>${escapeHtml(student.email)}</td>`}<td><a class="row-link" href="#search?code=${student.student_code}" aria-label="Xem chi tiết ${escapeHtml(student.student_code)}">${icon('arrow')}</a></td></tr>`).join('');
}
async function overview(signal) {
  main.innerHTML = heading('Tổng quan', 'Chào mừng bạn đến với không gian quản lý học tập.') + `<section class="welcome"><div><div class="welcome-label">KẾT NỐI THÔNG TIN · ĐỒNG HÀNH HỌC TẬP</div><h2>Mọi thông tin học tập,<br>trong một không gian.</h2><p>Tra cứu sinh viên, xem bảng điểm và theo dõi kết quả học tập nhanh chóng, thuận tiện.</p></div><a class="btn btn-white" href="#students">Khám phá danh sách ${icon('arrow')}</a></section><section class="stats-grid" aria-label="Thống kê hệ thống">${[['Tổng số sinh viên','users','students'],['Môn học','book','subjects'],['Bản ghi điểm','file','grades']].map(([title, svg, key]) => `<article class="stat-card"><div class="stat-top">${title}<span class="stat-icon">${icon(svg)}</span></div><div class="stat-value mono" id="stat-${key}"><span class="spinner" aria-label="Đang tải"></span></div><div class="stat-foot">${icon('check')}Dữ liệu từ hệ thống</div></article>`).join('')}</section><div id="stats-error"></div><div class="dashboard-grid"><div><section class="card"><div class="card-head"><div><h2>Tra cứu nhanh</h2><p>Tìm hồ sơ sinh viên bằng mã sinh viên</p></div>${icon('search')}</div><div class="card-body">${searchForm()}${examples()}</div></section><section class="card"><div class="card-head"><div><h2>Danh sách sinh viên</h2><p>Một vài hồ sơ trong hệ thống</p></div><a href="#students" class="btn btn-link btn-small">Xem tất cả ${icon('arrow')}</a></div><div id="preview-list">${loading()}</div></section></div><aside class="dashboard-aside"><section class="card"><div class="card-head"><h2>Hướng dẫn tra cứu</h2></div><div class="card-body"><ol class="guide-list"><li><span class="step-number">01</span><div><h3>Nhập mã sinh viên</h3><p>Sử dụng mã sinh viên để tìm đúng hồ sơ cần xem.</p></div></li><li><span class="step-number">02</span><div><h3>Xem thông tin cá nhân</h3><p>Kiểm tra họ tên, lớp, ngành học và năm nhập học.</p></div></li><li><span class="step-number">03</span><div><h3>Theo dõi kết quả học tập</h3><p>Xem điểm từng môn, tổng tín chỉ và điểm trung bình.</p></div></li></ol></div></section><div class="info-note">${icon('info')}<div><strong>Điểm trung bình theo tín chỉ</strong><p>GPA được tính trên thang 10, có trọng số theo số tín chỉ của từng môn học.</p></div></div></aside></div>`;
  const statsTask = (async () => {
    try {
      const stats = statsData || (await api('/api/stats', signal)).body;
      if (signal.aborted) return;
      statsData = stats;
      for (const key of ['students','subjects','grades']) document.querySelector(`#stat-${key}`).textContent = number(stats[`total_${key}`]);
    } catch (error) {
      if (signal.aborted) return;
      for (const element of document.querySelectorAll('.stat-value')) element.textContent = '—';
      showError(document.querySelector('#stats-error'), error);
    }
  })();
  const previewTask = (async () => {
    try {
      const { body } = await api('/api/students?page=1&limit=5', signal);
      if (signal.aborted) return;
      document.querySelector('#preview-list').innerHTML = body.data.length ? `<div class="table-scroll"><table><thead><tr><th>SINH VIÊN</th><th>LỚP</th><th aria-label="Chi tiết"></th></tr></thead><tbody>${studentRows(body.data, true)}</tbody></table></div><div class="table-footer">Hiển thị ${body.data.length} hồ sơ đầu tiên, sắp xếp theo mã sinh viên</div>` : empty('Chưa có sinh viên', 'Hệ thống chưa có dữ liệu. Vui lòng liên hệ người phụ trách để khởi tạo dữ liệu.');
    } catch (error) { if (!signal.aborted) showError(document.querySelector('#preview-list'), error); }
  })();
  await Promise.all([statsTask, previewTask]);
}
async function students(params, signal) {
  const rawPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1;
  const limit = [20,50,100].includes(Number(params.get('limit'))) ? Number(params.get('limit')) : 20;
  main.innerHTML = heading('Danh sách sinh viên', 'Khám phá hồ sơ, thông tin lớp và ngành học của sinh viên.') + `<section class="card"><div class="card-head"><h2>Hồ sơ sinh viên</h2><div class="list-toolbar"><label for="page-size">Mỗi trang</label><select id="page-size">${[20,50,100].map(size => `<option value="${size}" ${size === limit ? 'selected' : ''}>${size}</option>`).join('')}</select><a class="btn btn-primary btn-small" href="#search">${icon('search')}<span class="mobile-hide">Tra cứu</span></a></div></div><div id="student-list">${loading()}</div></section>`;
  try {
    const { body } = await api(`/api/students?page=${page}&limit=${limit}`, signal);
    if (signal.aborted) return;
    document.querySelector('#student-list').innerHTML = (body.data.length ? `<div class="table-scroll"><table><thead><tr><th>STT</th><th>MÃ SINH VIÊN</th><th>HỌ VÀ TÊN</th><th>LỚP</th><th>NGÀNH HỌC</th><th>NĂM NHẬP HỌC</th><th>EMAIL</th><th>CHI TIẾT</th></tr></thead><tbody>${studentRows(body.data, false, (page-1)*limit)}</tbody></table></div>` : empty('Không có dữ liệu ở trang này', 'Bạn có thể quay về trang trước hoặc tra cứu một mã sinh viên.')) + `<div class="table-footer"><span>${body.data.length ? `Hiển thị ${number((page-1)*limit+1)}–${number((page-1)*limit+body.data.length)}` : '0 hồ sơ'}</span><div class="pagination"><button data-page="${page-1}" data-limit="${limit}" aria-label="Trang trước" ${page <= 1 ? 'disabled' : ''}>${icon('back')}</button><span>Trang ${number(page)}</span><button data-page="${page+1}" data-limit="${limit}" aria-label="Trang sau" ${!body.pagination.has_next ? 'disabled' : ''}>${icon('chevron')}</button></div></div>`;
  } catch (error) { if (!signal.aborted) showError(document.querySelector('#student-list'), error); }
}
function profile(student, transcript = false) {
  return `<div class="profile"><div class="profile-top"><div class="profile-avatar" aria-hidden="true">${escapeHtml(initials(student.full_name))}</div><div class="profile-title"><h2>${escapeHtml(student.full_name)}</h2><span class="mono">${escapeHtml(student.student_code)}</span></div><span class="found-label">${icon('check')}Đã tìm thấy hồ sơ</span></div><dl class="profile-grid">${[['Lớp',student.class_name],['Ngành học',student.major],['Năm nhập học',student.enrollment_year],['Email',student.email]].map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>${transcript ? '' : `<div class="profile-actions"><a href="#transcript?code=${student.student_code}" class="btn btn-primary">${icon('file')}Xem bảng điểm ${icon('arrow')}</a></div>`}</div>`;
}
async function search(params, signal) {
  const code = params.get('code') || '';
  main.innerHTML = heading('Tra cứu sinh viên', 'Tìm hồ sơ và kết quả học tập theo mã sinh viên.') + `<div class="search-layout"><div><section class="card"><div class="card-head"><h2>Tìm kiếm hồ sơ</h2>${icon('search')}</div><div class="card-body">${searchForm('search', code)}${examples()}</div></section><section class="card" id="search-result" aria-live="polite">${code ? loading('Đang tìm sinh viên…') : empty('Bắt đầu từ mã sinh viên', 'Nhập mã sinh viên ở trên để xem thông tin hồ sơ và truy cập bảng điểm.')}</section></div><aside class="card"><div class="card-head"><h2>Thời gian phản hồi</h2>${icon('clock')}</div><div class="timing-list">${[['Truy vấn Database','db'],['Xử lý Backend','api'],['Phản hồi trình duyệt','browser']].map(([label,id]) => `<div class="timing-row"><span>${label}</span><strong><span id="time-${id}">—</span><small>ms</small></strong></div>`).join('')}</div><p class="timing-note">Được đo thực tế cho mỗi lần tra cứu. Thời gian Database bao gồm chờ connection pool và giao tiếp với PostgreSQL. Thời gian trình duyệt bao gồm nhận và đọc phản hồi.</p></aside></div>`;
  if (!code) return;
  try {
    const { body, status, browserMs } = await api(`/api/students/search?code=${encodeURIComponent(code)}`, signal);
    if (signal.aborted) return;
    document.querySelector('#search-result').innerHTML = status === 404 ? empty('Không tìm thấy sinh viên', 'Mã sinh viên này chưa có trong hệ thống. Hãy kiểm tra mã và thử lại.') : profile(body.data);
    document.querySelector('#time-db').textContent = body.performance.db_query_ms.toFixed(2);
    document.querySelector('#time-api').textContent = body.performance.api_processing_ms.toFixed(2);
    document.querySelector('#time-browser').textContent = browserMs.toFixed(2);
  } catch (error) { if (!signal.aborted) showError(document.querySelector('#search-result'), error); }
}
async function transcript(params, signal) {
  const code = params.get('code') || '';
  main.innerHTML = heading('Bảng điểm học tập', 'Xem điểm thành phần và điểm trung bình theo tín chỉ — thang 10.') + `<section class="card"><div class="card-body compact-search">${searchForm('transcript', code)}</div></section><section class="card" id="transcript-result" aria-live="polite">${code ? loading('Đang tải bảng điểm…') : empty('Tra cứu bảng điểm', 'Nhập mã sinh viên để xem kết quả từng môn học và điểm trung bình.', 'file')}</section>`;
  if (!code) return;
  try {
    const { body, status } = await api(`/api/students/${encodeURIComponent(code)}/transcript`, signal);
    if (signal.aborted) return;
    if (status === 404) { document.querySelector('#transcript-result').innerHTML = empty('Không tìm thấy sinh viên', 'Hãy kiểm tra lại mã sinh viên để tra cứu bảng điểm.'); return; }
    const { student, grades, summary } = body.data;
    document.querySelector('#transcript-result').innerHTML = profile(student, true) + `<div class="transcript-summary"><div><span>Môn đã có điểm</span><strong>${summary.total_subjects}</strong></div><div><span>Tổng số tín chỉ</span><strong>${summary.total_credits}</strong></div><div><span>GPA · thang 10</span><strong class="gpa">${summary.gpa_10 === null ? '—' : score(summary.gpa_10)}</strong></div></div>` + (grades.length ? `<div class="table-scroll"><table><thead><tr><th>MÔN HỌC</th><th>HỌC KỲ</th><th class="numeric">TÍN CHỈ</th><th class="numeric">GIỮA KỲ</th><th class="numeric">CUỐI KỲ</th><th class="numeric">TỔNG KẾT</th></tr></thead><tbody>${grades.map(g => `<tr><td><div class="student-name">${escapeHtml(g.subject_name)}</div><div class="student-code">${escapeHtml(g.subject_code)}</div></td><td>${escapeHtml(g.semester)}</td><td class="numeric">${g.credits}</td><td class="numeric">${score(g.midterm_score)}</td><td class="numeric">${score(g.final_score)}</td><td class="numeric score-total">${score(g.total_score)}</td></tr>`).join('')}</tbody></table></div>` : empty('Chưa có điểm học tập', 'Bảng điểm sẽ hiển thị khi dữ liệu được cập nhật.','file')) + `<div class="table-note">Điểm tổng kết = 40% giữa kỳ + 60% cuối kỳ.<br>GPA thang 10 = tổng (điểm tổng kết × tín chỉ) / tổng tín chỉ. Kết quả làm tròn đến 2 chữ số thập phân.</div>`;
  } catch (error) { if (!signal.aborted) showError(document.querySelector('#transcript-result'), error); }
}
function route() {
  if (location.hash === '#main') { main.focus(); return; }
  viewController?.abort();
  viewController = new AbortController();
  const [name, query = ''] = location.hash.slice(1).split('?');
  const view = navItems.some(([id]) => id === name) ? name : 'overview';
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  document.title = `${navItems.find(([id]) => id === view)[2]} · Student Academic Management System`;
  const handlers = { overview: (_, signal) => overview(signal), students, search, transcript };
  handlers[view](new URLSearchParams(query), viewController.signal).catch(error => showError(main, error));
}
main.addEventListener('submit', event => {
  const form = event.target.closest('.search-form');
  if (!form) return;
  event.preventDefault();
  const code = new FormData(form).get('code').trim().toUpperCase();
  const hash = `#${form.dataset.destination}?code=${encodeURIComponent(code)}`;
  if (location.hash === hash) route(); else location.hash = hash;
});
main.addEventListener('input', event => { if (event.target.name === 'code') event.target.value = event.target.value.toUpperCase(); });
main.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button?.dataset.action === 'retry') route();
  if (button?.dataset.page) location.hash = `#students?page=${button.dataset.page}&limit=${button.dataset.limit}`;
});
main.addEventListener('change', event => { if (event.target.id === 'page-size') location.hash = `#students?page=1&limit=${event.target.value}`; });
window.addEventListener('hashchange', route);
route();
api('/api/health').then(({ body }) => {
  const connected = body.status === 'ok';
  document.querySelector('#connection-dot').classList.add(connected ? 'ok' : 'error');
  document.querySelector('#connection-text').textContent = connected ? 'Kết nối hệ thống sẵn sàng' : 'Kết nối tạm thời gián đoạn';
}).catch(() => {
  document.querySelector('#connection-dot').classList.add('error');
  document.querySelector('#connection-text').textContent = 'Kết nối tạm thời gián đoạn';
});
