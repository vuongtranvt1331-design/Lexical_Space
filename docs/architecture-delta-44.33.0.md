# SpaceSuite 44.33.0

Điều chỉnh từ bản 44.32.0, ngày 21/11/2026:

- Sprinkler vẫn một viên mỗi lượt. Cooldown 1,25 → 0,625 giây; pha chuẩn bị 0,15 → 0,075 giây. Tổng chu kỳ bắn giảm một nửa ở cả solo và co-op; tốc độ bay viên đạn giữ nguyên.
- Siren intro giảm gain 0,35 → 0,105: giảm 70%, còn 30% âm lượng trước.
- Không đổi dữ liệu người dùng, protocol, ảnh hoặc các kỹ năng khác. Cấu trúc và hợp đồng ở `architecture-delta-44.32.0.md` tiếp tục áp dụng.
- Kiểm tra: chín test gameplay/audio đạt. Build lại cache dùng chung, không xóa cache/storage của người dùng. Không deploy.
