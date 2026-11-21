# SpaceSuite 44.37.0 — vết khuyết ngẫu nhiên, thu nhỏ trước đài chỉ huy và hyperspace

Ngày 21/11/2026. Tiếp tục điều chỉnh boss 6 theo bản 44.36.0; không thay cơ chế các boss khác.

- Mỗi lần mở lõi tạo một kế hoạch hư hỏng có sáu vùng: bốn mép thân, một đài chỉ huy, một vùng động cơ. Vị trí, bán kính ngang/dọc, độ xé sâu, đường gãy 16 đỉnh và thứ tự nổ ngẫu nhiên bằng RNG replay hiện có. Kế hoạch nằm trong `boss.dread.finish.damageSites`, snapshot/reconnect giữ nguyên. Renderer không lấy số ngẫu nhiên mới.
- Vùng nguyên vẹn bị cắt bởi các mask đa giác giao nhau theo phép loại trừ tích lũy, tránh lỗ chồng nhau tự lấp lại. Dùng lại texture rìa giáp hỏng từ PNG 44.36.0 và vẽ phần sâu bên trong đài chỉ huy tối hơn. Không tạo thêm PNG hoặc thay hull gốc. Hai hộ tống không nhận mask hư hỏng.
- Khi kéo xa, camera bám vị trí trước đài chỉ huy (native hull v=0,69); tàu người chơi thu từ 84 px về 8/3 px, nằm giữa thân trước phần đài tam giác. Trong co-op, hai tàu cực nhỏ ở gần nhau hai bên tâm. Không còn nằm dưới đáy màn hình cách xa tàu mẹ.
- Sau 4 giây kéo xa, giữ toàn cảnh **4 giây**; thêm các vụ nổ nhỏ trong các vùng hỏng. Sau đó cắt trực tiếp về nền boong hiện tại, tàu người chơi hiện đủ kích thước và hyperspace bay lên khỏi màn trong 0,8 giây. Hoạt ảnh không chuyển ngược lại toàn cảnh hạm đội sau khi đã rời đi.
- Hoàn tất hyperspace mới chốt chiến thắng/thưởng nâng súng và hội thoại hiện có. Boss 6 tự thu lõi thưởng, không thêm cảnh đợi nhặt lõi sau khi tàu đã hyperspace. Cờ `dreadDeparted` giữ tàu người chơi ẩn trong đoạn thưởng/hội thoại, được xóa khi vào lượt mới hoặc boss tiếp theo. Không thêm khóa storage hoặc cloud writes.
- Fighter boss 6 giảm xác suất bắn mỗi lần kiểm tra từ 0,26 xuống 0,13; cooldown kiểm tra bắn vẫn 3,4–4,4 giây. Các ụ súng giữ nguyên tham số đã chốt.
- Phần đội hình chiến đấu 20–30 chiếc, đổi sau 15 giây hoặc hạ 10 chiếc, và xoay mũi về người chơi **chỉ đang đề xuất để duyệt**, chưa triển khai. Intro hiện có vẫn 400 chấm / 5 cụm V như 44.36.0.

File sửa: `dreadnought-ending.js`, `game.js`, `dreadnought-config.js`, kiểm tra gameplay, tài liệu và thông tin phiên bản/footer/cache. Version 44.37.0, ngày 21/11/2026. Không deploy.

Kiểm tra tập trung: 20 test gameplay/audio, gồm biến thiên kế hoạch hỏng, bridge/engine, renderer không dùng RNG, vị trí/kích thước tàu nhỏ, cắt về boong đủ kích thước, hyperspace thoát khỏi mép trên, thời gian giữ toàn cảnh, quota, retry, co-op/reconnect và thưởng không lặp. Chưa xác nhận hình ảnh bằng trình duyệt thật do kết nối browser tool không hoạt động ở lượt trước.
