# SpaceSuite 44.35.0

Ngày 21/11/2026. Chỉ điều chỉnh boss 6 Dreadnought Assault:

- Bỏ hệ số hồi chiêu co-op 0,7. Cả bảy loại ụ dùng cooldown giống solo; giữ nhịp Sprinkler bốn nòng đã chốt.
- Mục tiêu 100 địch solo, 150 địch tổng cộng cho cả đội co-op. Mỗi fighter hoặc ụ bị phá tính một, không dùng trọng số ụ +3. Tên lửa bị bắn hạ, Sprinkler bất tử và địch tự rời màn không cộng. Va chạm phá fighter cũng được tính một; không cộng score thưởng bắn hạ cho va chạm.
- Counter mới `boss.dread.kills`; HUD TARGETS và thanh tiến độ dùng đúng quota theo chế độ. Snapshot/replay hiện có giữ counter này, không thêm storage key, DB hay cloud write. Snapshot cũ thiếu kills bắt đầu bộ đếm mới ở 0, không coi điểm trọng số cũ là số địch.
- Đủ quota kết thúc màn, bỏ điều kiện sống tối thiểu 110 giây. Không đổi score thưởng 75/fighter và 250/turret hay các boss khác.
- Boss Lab ghi rõ 100/150 và hồi chiêu bằng nhau. Version/footer/cache 44.35.0. Không deploy.
- 12 test gameplay/audio đạt, gồm quota solo/co-op, chống đếm lặp, loại tên lửa khỏi mục tiêu, kết thúc đúng quota và cooldown của cả bảy ụ.

Cấu trúc còn lại theo `architecture-delta-44.32.0.md`, các điều chỉnh Sprinkler/siren theo 44.33.0 và 44.34.0.
