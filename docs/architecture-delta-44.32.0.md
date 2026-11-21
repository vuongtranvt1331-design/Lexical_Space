# SpaceSuite 44.32.0 — boss 6 và chuẩn SFX

- `apps/space-dominators/dreadnought-config.js`: tham số HP, cooldown, mốc mở khóa, speed, cap, tuyến wave và pivot đầu súng.
- `dreadnought.js`: trạng thái plain JSON của deck assault; đọc random replay host hiện có; điều khiển bảy ụ, lưới 36 fighter, wave chéo/ngang/hai mép, hit test và renderer raster có fallback. Không đọc/ghi DB.
- `boss-campaign.js`, `boss-encounters.js`: boss 6 cũ đã bỏ đường chạy, thay bằng module mới; những boss khác giữ cơ chế hiện hành.
- `boss-six-preview.js`, `game.js`: năm đội hình V rộng trong intro, tiến vào mũi tàu, chuyển trực tiếp sang combat sau 28,5 giây; cặp pilot có vị trí và kích thước nối tiếp lúc vào combat.
- `assets/sprites/manifest.json`: 20 file PNG mới; từng đầu súng xoay bằng pivot riêng tại khớp. `tools/asset-packs/boss-six/generated-sources.json` ghi nguồn raster gốc được giữ nguyên ngoài app; `normalize-generated.py` chuẩn hóa kích thước bằng nearest neighbor. Không dùng Pillow để vẽ thay ảnh AI.
- `assets/sfx/manifest.json`, `sfx-config.js`: 24 event, ánh xạ sang OGG Kenney CC0 đã có. Script tạo cấu hình: `tools/asset-packs/boss-six/configure-sfx.py`.
- `sound.js`: sample cache dùng chung, synth dự phòng, gain/cooldown/cap theo event; ngân sách combat 8 voice. Giữ luồng MP3 intro do người dùng cung cấp tách riêng. `station.js`/`index.html`/`station.css`: icon loa có thể mute/unmute, pause không ghi đè icon bằng chuỗi dài. Boss Lab thêm volume/mute ngay trong bảng tester.
- `tools/build-suite.py`: đóng gói script mới, 20 sprite, deck/hull và OGG combat vào cache dùng chung. Version và footer 44.32.0, ngày 21/11/2026. Không xóa storage/cache của người dùng.

Giữ nguyên LexicalSpaceDB v3, quyền sở hữu từ vựng và read-only ở game; không schema/migration/cloud write; giao thức co-op hiện có, trạng thái mới nằm trong snapshot boss và dùng replay như các boss khác. Không triển khai/push.

Phân tích gameplay, tất cả thông số và nguồn web: [chuẩn hiệu ứng](space-dominators-dreadnought-effects.md). Chứng cứ kiểm tra và hash: `space-dominators-dreadnought-verification.json`.

Giới hạn: nền boong hiện nối panel bằng phản chiếu dọc, chưa có 5–6 panel vẽ riêng. Kiểm thử logic/audio dùng VM, không tuyên bố đã nghe thử hay xác nhận hình ảnh trên trình duyệt thật hoặc FPS của máy H81/4 GB.
