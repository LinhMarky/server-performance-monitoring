# DE20 - Chạy MỘT lần đo k6 và ghi nhật ký.
# Ví dụ:
#   .\chay_do.ps1 -TrangThai truoc -VUS 50 -Lan 1
#   .\chay_do.ps1 -TrangThai sau   -VUS 200 -Lan 3 -GhiChu "quat on dinh"
# Kết quả: ket_qua_tho\{trangthai}_{vus}vu_lan{n}_k6.csv (+ _k6.log), và 1 dòng trong nhat_ky_do.csv
param(
  [Parameter(Mandatory)][ValidateSet('truoc','sau','pilot')][string]$TrangThai,
  [Parameter(Mandatory)][int]$VUS,
  [Parameter(Mandatory)][int]$Lan,
  [string]$Base = 'http://3.26.226.194:3000',
  [string]$Warmup = '30s',
  [string]$Duration = '120s',
  [double]$Miss = 0,
  [string]$GhiChu = ''
)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$k6 = (Get-Command k6 -ErrorAction SilentlyContinue).Source
if (-not $k6) { $k6 = 'C:\Program Files\k6\k6.exe' }

$ten = "{0}_{1}vu_lan{2}" -f $TrangThai, $VUS, $Lan
$csv = "ket_qua_tho\${ten}_k6.csv"
$log = "ket_qua_tho\${ten}_k6.log"
if (Test-Path $csv) { throw "$csv đã tồn tại. Đổi số lần hoặc xóa file cũ nếu lần đo đó hỏng (ghi lý do vào nhật ký)." }

# Kiểm tra server sống và ghi trạng thái phía server trước khi đo
$h = Invoke-RestMethod "$Base/api/health" -TimeoutSec 15
$s = Invoke-RestMethod "$Base/api/students/search?code=SV0199999" -TimeoutSec 30
Write-Host ("Server: {0}/{1}; db_query_ms(SV0199999)={2}" -f $h.status, $h.database, $s.performance.db_query_ms)

$batDau = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Write-Host "Bắt đầu $ten lúc epoch $batDau ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
& $k6 run -e BASE=$Base -e VUS=$VUS -e WARMUP=$Warmup -e DURATION=$Duration -e MISS=$Miss `
      --out "csv=$csv" test.js 2>&1 | Tee-Object -FilePath $log
$maThoat = $LASTEXITCODE
$ketThuc = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$nk = 'nhat_ky_do.csv'
if (-not (Test-Path $nk)) {
  'stt,ten,trang_thai,vus,lan,epoch_bat_dau,epoch_ket_thuc,gio_bat_dau,may_khach,db_query_ms_truoc_do,k6_exit,ghi_chu' |
    Set-Content -Encoding utf8 $nk
}
$stt = (Import-Csv $nk).Count + 1
$dong = '{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},"{11}"' -f $stt, $ten, $TrangThai, $VUS, $Lan, $batDau, $ketThuc,
  (Get-Date ([DateTimeOffset]::FromUnixTimeSeconds($batDau).LocalDateTime) -Format 'yyyy-MM-dd HH:mm:ss'),
  $env:COMPUTERNAME, $s.performance.db_query_ms, $maThoat, ($GhiChu -replace '"', "'")
Add-Content -Encoding utf8 $nk $dong
Write-Host "Xong $ten : epoch $batDau -> $ketThuc. Đã ghi nhật ký. Báo người trực server dừng monitor.sh và đặt tên ${ten}_mon.csv"
