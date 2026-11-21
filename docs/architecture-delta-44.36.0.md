# SpaceSuite 44.36.0 — kết liễu lõi và thân tàu bị xé mảng

Ngày 21/11/2026. Chỉ boss 6 Dreadnought Assault.

## Luồng kết thúc

1. Đủ 100 địch solo / 150 địch co-op: chưa kết thúc trận. HUD đổi thành 3–2–1. Lõi đóng trôi từ y=-24 xuống với tốc độ nền 38 px/s. Địch ngừng tấn công, đạn nguy hiểm được thu dọn để người chơi tập trung vào thao tác.
2. Sau đúng 3 giây, lõi mở. Chỉ một lần nhấn E mới trong khoảng `[3, 3.25)` được chấp nhận. Giữ phím trước đó không tự khai hỏa. E không dùng cooldown kỹ năng tàu trong pha này.
3. Bỏ lỡ: lõi đóng, yêu cầu cộng dồn thêm 20 địch solo / 30 địch co-op. Bộ đếm giữ số đã hạ. Các ụ được chuẩn bị lại trước khi bắn, tránh một loạt đạn tức thì sau thời gian chờ.
4. Thành công: tên lửa từ chính tàu người bấm E bay vào lõi 0,7 giây. Lõi nổ trước. Tiếp theo 3,5 giây nổ dây chuyền trên **nền boong hiện tại**, ngẫu nhiên phá tàu con/ụ súng và nổ thêm nhiều điểm trên boong. Những vụ nổ điện ảnh này không cộng vào quota hay score.
5. Kéo xa trong 4 giây. Chỉ tàu mẹ ở giữa lần lượt mất sáu mảng giáp; hai hộ tống vẫn nguyên vẹn. Mảnh vỡ lấy texture từ sprite tàu gốc, có vận tốc 55–155 px/s ra ngoài, tốc độ quay ±3 rad/s, giảm vận tốc với hệ số exp(-0,35×dt), mờ dần và dọn sau 6 giây. Không có nổ trắng xóa cả tàu.
6. Giữ toàn cảnh 1,5 giây rồi mới chạy thưởng/lõi nâng cấp và hội thoại hiện có. Tàu mẹ hư hỏng còn ở nền hậu cảnh; không dùng thêm hiệu ứng phá hủy toàn bộ hull của boss 6 cũ.

Pha xem điện ảnh không gây sát thương. Các điều khiển Pause/ESC hiện có vẫn hoạt động; mọi thời gian là thời gian mô phỏng nên pause không làm trôi cửa sổ E.

## Co-op và phục hồi

Một trong hai người còn sống có thể bắn lõi. Host chốt kết quả, phát lại lệnh cùng trạng thái `boss.dread.finish`; không đồng bộ từng mảnh vụn liên tục. Guest gửi `dread-core-fire` với mã lần mở lõi và mốc nhấn theo thời gian mô phỏng. Cửa sổ hiển thị vẫn 250 ms; host có khoảng tiếp nhận muộn tối đa 1 giây cho lệnh đã nhấn trong cửa sổ trên máy guest. Kiểm tra ID, số hữu hạn, giới hạn thời gian và người bắn còn sống. Lệnh lặp hoặc lệnh của lần mở trước không bắn thêm tên lửa. Đây là xử lý độ trễ có giới hạn, không phải hệ thống chống gian lận độc lập.

Snapshot/replay giữ pha, timer, lần mở, quota tăng thêm, người bắn, mảnh vỡ và vùng hư hỏng. Không thêm DB, storage key hay cloud write. Các boss khác giữ nguyên cooldown và luồng kết thúc.

## Asset và ảnh tham chiếu

Dùng built-in imagegen trực tiếp, chỉnh từ `assets/star-destroyer.png`. Không thay ảnh nguyên vẹn gốc. File mới:

- `apps/space-dominators/assets/boss-six-ending/hull-bitten.png`: 288×416, alpha thật, sáu chỗ khuyết thông ra mép ngoài. Từng vùng được vẽ thay cho phần nguyên vẹn, không chồng alpha để vô tình lấp lại lỗ thủng.
- `apps/space-dominators/assets/boss-six-ending/reactor.png`: 96×96, lõi mở.
- `apps/space-dominators/assets/boss-six-ending/reactor-closed.png`: 96×96, lõi đóng.

Prompt đầy đủ, nguồn ảnh gốc sinh bởi tool và chế độ tạo: `tools/asset-packs/boss-six/ending-image-sources.json`. Chuẩn hóa kích thước/alpha bằng nearest-neighbor: `normalize-ending.py`; không vẽ lại hình thay cho imagegen. Nổ dùng chung `SpaceBossFX.drawBlast`, không tạo atlas nổ riêng. Ba PNG và module mới được thêm vào cache PWA.

## Intro và điểm kiểm tra nhanh

Intro tăng 200 → **400 tàu nhỏ**, giữ năm cụm chữ V và năm hàng mỗi cụm; mỗi hàng tăng 8 → 16 tàu để cánh V rộng gấp đôi. Vẫn dùng chấm màu 2×2, không tạo 400 thực thể gameplay/âm thanh.

Trong Boss Lab chọn boss 6, bấm **Test reactor finale** để thử riêng pha lõi và nổ, không cần hạ đủ 100 địch. Nút thử này chỉ dành cho solo; chơi co-op vẫn dùng quy trình vào phòng/Boss Lab hiện có.

File thay đổi chính: `dreadnought-ending.js` mới; `dreadnought.js` chặn kết thúc ở quota và giao pha lõi cho module mới; `game.js` nối E, replay, cutscene và hậu cảnh; `boss-six-preview.js` tăng đội hình; HTML/Boss Lab/loader chờ ảnh mới; build cập nhật cache/version/footer 44.36.0. Dữ liệu từ vựng vẫn read-only.

Kiểm chứng logic: cửa sổ 250 ms, thử lại +20/+30, bỏ lệnh cũ, guest truyền chậm, nổ boong đủ 3,5 giây, sáu vùng hư hỏng, mảnh có vận tốc, replay/reconnect, chuyển sang thưởng, nút thử nhanh và đủ 400 chấm trong intro. Sáu vùng mask đều có pixel giáp thật sự chuyển từ đục sang alpha trong ảnh hư hỏng. Chưa xác nhận hình ảnh/chuyển động trong trình duyệt thật: công cụ browser trả `Transport closed`. Không deploy.
