# Bộ asset cho màn chiến hạm boss 6

Gói này chứa 7 prompt độc lập, mapping 20 PNG và công cụ nhập/kiểm tra. Đã tạo trực tiếp và cài đủ 20 PNG mới trong bản 44.32.0. Bộ prompt bên dưới giữ lại để tạo biến thể sau này. Gameplay và SFX đã được tích hợp; xem docs/space-dominators-dreadnought-effects.md.

## Mẫu tham chiếu

Giải nén upload-references.zip rồi đính kèm cả ba ảnh vào chat tạo ảnh. Ảnh nền dùng giáp xám xanh, rãnh giữa tối, đèn cyan và hổ phách. Sprite tàu hiện hành dùng viền tối, các khối pixel rõ và lõi sáng. Turret cũ là mẫu màu và vật liệu, có độ phân giải thấp hơn bộ mới.

Gửi lần lượt nội dung prompts/01-group.txt đến 07-group.txt. Mỗi prompt tự chứa quy chuẩn và danh sách file. Dùng cùng một chat để giữ bảng màu. Sau mỗi nhóm, tải ZIP về máy rồi nhập bằng công cụ bên dưới.

## Nhập ảnh trên Windows

Cần Python và Pillow. Pillow đang có trên máy này.

Chạy Import-Assets.cmd rồi kéo file ZIP hoặc thư mục chứa PNG vào cửa sổ và nhấn Enter. Công cụ chỉ nhận đúng tên trong manifest. Mọi ảnh trong lô nhập đều được kiểm tra trước khi ghi. Ảnh bị sai kích thước, thiếu alpha hoặc mép bị cắt sẽ được báo lỗi để sửa trong ChatGPT web. File đã có chỉ được thay khi dùng tùy chọn --replace.

Có thể chạy trực tiếp từ thư mục dự án

```powershell
python tools/asset-packs/boss-six/manage-assets.py import --source "C:/Users/ADMIN/Downloads/group-1.zip"
python tools/asset-packs/boss-six/manage-assets.py check
```

Mỗi lô có thể chứa một nhóm. Sau khi nhập, chương trình liệt kê những file còn thiếu. Khi đủ bộ, lệnh check phải kết thúc với mã 0. Nếu ảnh tạo ở kích thước lớn hơn, yêu cầu ChatGPT web xuất lại đúng kích thước theo prompt.

## Kiểm tra hình trước khi dùng

- Đế và đầu tách lớp, tâm xoay trùng nhau, đầu không bị cắt khi xoay.
- Bảy đầu ụ phân biệt được qua hình dáng. Sprinkler dùng chung tur_base nhưng có bốn vòi và marker riêng.
- Đạn nhỏ vẫn nhìn rõ trên nền tối. Indicator không che từ vựng.
- Khói/lửa tên lửa nằm trong alpha bounds và không lệch khỏi đuôi.
- Hai tia laser có mép đầu/cuối khớp để lặp lại.
- Tàu địch có mũi hướng xuống. Không có ảnh tàu khác nằm chung ô.
- Xem contact sheet do ChatGPT xuất, rồi thử từng asset ở kích thước hiển thị trong game.

## Mapping cho code

Đường dẫn tính từ apps/space-dominators/assets/sprites/. manifest.json lưu kích thước, tâm xoay, đầu nòng và điểm động cơ. Tọa độ là pixel trong ảnh nguồn. collisionRadius chỉ là thông số khởi điểm để tích hợp và cân bằng. Script không tự đưa chúng vào gameplay.

| File | Kích thước | Nhóm |
|---|---|---|
| `turrets/tur_base.png` | 128×128 | 1 |
| `turrets/head_fan_wave.png` | 128×128 | 1 |
| `turrets/head_expanding_orb.png` | 128×128 | 1 |
| `turrets/head_twin_crossfire.png` | 128×128 | 1 |
| `turrets/head_homing_missile.png` | 128×128 | 2 |
| `turrets/head_shotgun_missile.png` | 128×128 | 2 |
| `turrets/turret_sprinkler.png` | 128×128 | 2 |
| `turrets/head_charging_laser.png` | 128×128 | 2 |
| `ui/ind_priority_target.png` | 48×48 | 3 |
| `ui/ind_sprinkler_marker.png` | 48×48 | 3 |
| `projectiles/proj_standard_fan.png` | 32×32 | 4 |
| `projectiles/proj_expanding_orb.png` | 64×64 | 4 |
| `projectiles/proj_twin_cross.png` | 32×64 | 4 |
| `projectiles/proj_sprinkler_orb.png` | 32×32 | 4 |
| `projectiles/proj_missile_homing.png` | 32×64 | 5 |
| `projectiles/proj_missile_shotgun.png` | 32×64 | 5 |
| `projectiles/beam_laser_charge.png` | 32×256 | 6 |
| `projectiles/beam_laser_fire.png` | 32×256 | 6 |
| `enemies/enemy_fighter.png` | 128×128 | 7 |
| `ui/ind_fleet_entry_red.png` | 48×64 | 3 |

## Ràng buộc gameplay đi kèm tài liệu yêu cầu

Ưu tiên hiển thị marker trên homing, shotgun và laser. Sprinkler là ụ duy nhất bất tử. Các đầu khác có thể dùng chung nền đế và hiệu ứng nổ sẵn có. Bộ này chuẩn bị ảnh cho lưới fighter 3×12, wave vòng cung và bảy cơ chế tấn công. Cấu hình HP/cooldown/wave và tích hợp runtime thuộc phần triển khai gameplay trong tài liệu yêu cầu đính kèm.



## Bổ sung thiết kế đã chốt

Toàn bộ ảnh mới là pixel 8-bit. Các nòng cũ chỉ tham chiếu bảng màu. Tàu địch mới có buồng lái tròn, hai cánh đứng đa giác và khung nối riêng, gợi dáng TIE Fighter. Sprite gốc hướng xuống để code xoay theo đường bay ngang, chéo hoặc dọc hai bên. ind_fleet_entry_red.png là biển đỏ dùng trước các hướng đội hình sắp đến. Đây là tài nguyên hình ảnh và quy ước tích hợp; các quỹ đạo và luật chặn vùng cần được triển khai trong module gameplay.
