# LexicalSpace: bản sửa PWA Android Chrome

Bản PWA: **43.1.0 (miniupdate)**. Ngày kiểm tra và cập nhật footer: **15/11/2026**. Quy trình kiểm tra và kết quả dưới đây được ghi nhận trước khi phát hành; kiểm tra Android thật vẫn cần thực hiện sau deploy.

## Baseline đã đối chiếu

- Dự án chính: `LexicalSpace-v29/LexicalSpace-project`.
- Không tìm thấy `AGENTS.md` hoặc baseline riêng trong dự án và các thư mục cha đã kiểm tra. Đã đọc `IMPLEMENTATION.md`, mã hiện tại và lưu danh sách SHA-256 của 75 file trước khi sửa trong workspace kiểm tra.
- HTML, `service-worker.js` và `js/core/offline.js` local khớp bản GitHub Pages khi chuẩn hóa xuống dòng.
- Trang HTTPS hiện tại và service worker trả 200, worker có fetch handler. Toàn bộ 39 tài nguyên trong CORE đang deploy trả 200.
- HTML đang deploy chưa liên kết manifest, favicon là SVG data URL. `/Lexical_Space/manifest.webmanifest` và `manifest.json` đều trả 404. Đây là thiếu sót được xác minh, không phải bằng chứng rằng Android không còn bất kỳ trở ngại nào khác.

## Các file thay đổi

| File | Nội dung |
| --- | --- |
| `manifest.webmanifest` | Tên, mô tả, id/start_url/scope ổn định, standalone, màu và icon. |
| `index.html` | Liên kết manifest, favicon PNG, Apple touch icon và theme-color. Không đổi nội dung/giao diện app. |
| `assets/icons/icon-192.png`, `icon-512.png` | Icon PNG từ ký hiệu `>/_`, nền trắng và xanh `#4255ff` hiện tại. |
| `assets/icons/icon-maskable-192.png`, `icon-maskable-512.png` | Icon opaque riêng; toàn bộ dấu nhận diện nằm trong hình tròn an toàn bán kính 40% chiều rộng. |
| `service-worker.js` | Chỉ cập nhật VERSION và CORE để precache manifest cùng icon. Giữ nguyên thuật toán install/activate/fetch. |
| `serve_local.py` | Khai báo MIME `.webmanifest` rõ ràng cho trình chạy localhost. |
| `tests/pwa.test.js` | Kiểm tra đường dẫn, PNG, precache và chỉ dọn shell cache cũ trong đúng scope. |
| `package.json`, `package-lock.json` | Đồng bộ phiên bản miniupdate 43.1.0. |
| `AGENTS.md` | Lưu quy tắc X.Y.z và cập nhật ngày footer cho các lần sửa sau. |
| `PWA-UPDATE.md` | Báo cáo và quy trình cập nhật này. |

`id`, `start_url`, `scope` dùng `./`, được tính tương đối từ URL manifest. Trên GitHub Pages cả ba thành `https://vuongtranvt1331-design.github.io/Lexical_Space/`; trên launcher localhost chúng vẫn đúng ở `/`. Không thêm query vào định danh; link chia sẻ deck vẫn hoạt động như trước khi mở trên trình duyệt.

Không sửa Firebase, schema/tên IndexedDB, khóa localStorage, progress, sync hay logic học. Không thêm nút Install chưa được trình duyệt cho phép. Chưa có nút cài trong app nên không có prompt giả/luôn hiện. Cài bằng menu Chrome là cách dự phòng.

## Kết quả đã kiểm chứng

- HTTP local tại `/Lexical_Space/`: HTML, manifest, worker và 4 PNG đều 200. Manifest có MIME `application/manifest+json`, PNG `image/png`, worker JavaScript.
- Chromium 157 trên Windows trong môi trường kiểm tra: đọc được manifest JSON, giải mã đủ 4 PNG đúng kích thước, worker cũ và mới đều install/activate thành công, scope đúng. Một tài liệu trong scope được worker mới kiểm soát.
- Nâng cấp từ nội dung worker đang deploy sang worker mới: tài nguyên PWA có trong cache mới. Chỉ shell cache cũ cùng scope được thay thế; cache khác được giữ nguyên.
- Dữ liệu mẫu được tạo riêng tại localhost: toàn bộ words (bao gồm SRS), metadata, pendingOps và localStorage không thay đổi sau nâng cấp worker. Không dùng tài khoản hoặc dữ liệu học thật cho thử nghiệm này.
- 124 kiểm tra tự động thành công. Không thấy lỗi manifest/service worker trong console của app local; vẫn có hai cảnh báo cũ về Tailwind CDN và API persistence Firebase deprecated, không sửa trong phạm vi PWA.
- Đã kiểm tra pixel của cả hai icon maskable: nền opaque, không có pixel nhận diện ngoài vùng tròn an toàn.

Chưa deploy nên không thể xác nhận manifest/icon mới trả 200 trên GitHub Pages. Chưa kiểm tra Android thật, Android WebAPK, hộp thoại cài native, màn hình splash, hay mở standalone sau khi cài. Không dùng điểm Lighthouse làm bằng chứng đã cài thành công.

## Cập nhật deploy an toàn (chỉ thực hiện khi được yêu cầu)

1. Publish cùng một bản gồm HTML, manifest, toàn bộ thư mục icon và worker mới vào đúng repo/path `/Lexical_Space/`. Không đổi origin, tên repo hoặc đường dẫn, vì dữ liệu trình duyệt gắn với origin hiện tại. Không chạy chức năng xóa/reset dữ liệu.
2. Sau khi GitHub Pages hoàn tất, kiểm tra trực tiếp:
   - `/Lexical_Space/manifest.webmanifest`: 200, JSON manifest, không phải trang HTML/404.
   - 4 đường dẫn PNG ghi trong manifest: 200, `image/png`, đúng 192/512.
   - `id`, `start_url`, `scope` resolve vào `/Lexical_Space/`; worker có VERSION mới và CORE chứa các tài nguyên PWA.
3. Trên Android Chrome bình thường (không phải cửa sổ ẩn danh hoặc trình duyệt nhúng): mở URL gốc, có mạng, tải lại trang. Đợi worker mới kích hoạt; nếu đang giữ tab cũ, đóng rồi mở lại tab và tải lại. Không bấm Clear site data, không xóa IndexedDB/localStorage, không unregister worker, không gỡ app để khắc phục cache.
4. Mở menu Chrome → Cài đặt và tạo lối tắt → Cài đặt. Nếu Chrome chưa đề xuất cài, tương tác và ở lại trang một lúc rồi thử lại; trình duyệt có điều kiện đề xuất riêng. Tạo lối tắt vẫn là phương án dùng tạm, không đồng nghĩa cài PWA thành công.
5. Xác nhận cài được, icon không bị cắt, mở từ màn hình chính thành cửa sổ standalone, profile/từ/SRS còn nguyên. Thử mở lại khi mất mạng sau một lần tải online. Ghi lại phiên bản Chrome và thông báo lỗi nếu Android vẫn từ chối.
6. Khi cần chẩn đoán sâu, kết nối Android với Chrome DevTools qua `chrome://inspect`; xem Application → Manifest/Service Workers và lỗi Installability. Không sửa dữ liệu để thử cài.

Tài liệu chính thức: [Chrome install criteria](https://web.dev/articles/install-criteria), [maskable safe zone](https://web.dev/articles/maskable-icon), [Chrome và Lighthouse PWA checks](https://developer.chrome.com/blog/update-install-criteria).
