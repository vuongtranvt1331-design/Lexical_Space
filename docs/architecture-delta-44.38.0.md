# SpaceSuite 44.38.0 — bốn đội hình và sprite thân tàu hỏng có kết cấu

Ngày 21/11/2026. Chỉ màn boss 6 Space Dominators.

## Đội hình đã áp dụng

Module mới `apps/space-dominators/dreadnought-formations.js` thay lịch lưới 36 tàu / wave bay qua cũ bằng một đội hình chiến đấu duy nhất:

| Mẫu | Số tàu | Bố cục |
| --- | --- | --- |
| grid | 30 | Ba hàng, mỗi hàng mười tàu |
| blocks | 27 | Ba khối 3×3 ở ba vùng phía trên |
| vee | 25 | Năm chữ V, mỗi V năm tàu, góc mở 120° |
| diamonds | 25 | Năm cụm kim cương, mỗi cụm năm tàu |

Đội đầu tiên là grid, các mẫu còn lại dùng bag xáo trộn không lặp ngay mẫu vừa chơi. Các cụm có jitter vị trí giới hạn trong vùng riêng. Khoảng cách tâm tàu ít nhất 70 px (sprite 46 px); chuyển động cả đội giữ nguyên khoảng cách nên không chồng sprite khi xoay.

Vào đội hình trong 2,4 giây theo đường Bézier có easing: ngang, chéo, mép trái hoặc mép phải. Giữ đội hình **15 giây kể từ khi xếp xong**, hoặc rút sớm khi **10 fighter thuộc đội hình đó đã bị tiêu diệt**. Những ụ súng bị phá không kích hoạt ngưỡng 10 fighter. Đội rút theo đúng đường vào đảo ngược, giữ vị trí liên tục, mất 2,4 giây. Nếu bị hạ 10 chiếc trước khi xếp xong thì đảo ngược phần đường đã bay. Fighter còn sống rút lui không cộng vào quota, score hay credit.

Đội mới chỉ vào khi đội cũ đã ra; có khoảng nghỉ 0,5 giây và cảnh báo đỏ 3 giây. Đội đầu vào ngay, không có cảnh báo chờ. Không quá 30 fighter của các đội hình mới cùng lúc. Snapshot cũ đang có lưới 36/wave cũ được đưa ra ngoài theo một pha rút lui, không xóa để cộng thành tích.

Thân/nòng của mọi fighter xoay về người chơi còn sống gần nhất, độc lập với hướng bay; đạn xuất phát từ phía mũi. Xác suất bắn vẫn 13%, nhịp kiểm tra bắn giữ nguyên. Khi đội đang vào/rút hoặc có cảnh báo, chỉ Sprinkler và ụ tên lửa hoạt động; các ụ khác bỏ charge cũ và chờ chuẩn bị lại. Khi xếp xong, các ụ hoạt động bình thường. Không cộng hiệu ứng âm từng tàu, vẫn dùng một cue wave với voice cap hiện hành.

Trạng thái layout, tọa độ đích, đường vào, pha, timer, số fighter bị hạ và tọa độ bắt đầu rút nằm trong boss snapshot/replay. Không thêm giao thức hay storage key. Trượt cửa sổ lõi rồi trở lại combat cũng rút đội cũ từ vị trí hiện tại trước khi vào đội mới, tránh nhảy vị trí.

## Sprite thân tàu hư hỏng

User yêu cầu bỏ cách khoét hình học trong suốt. Renderer `dreadnought-ending.js` đã bỏ `damagePath`, clipping/erase hull và thay bằng hai PNG atlas thật:

- `assets/boss-six-ending/hull-damage-1.png`
- `assets/boss-six-ending/hull-damage-2.png`

Mỗi atlas 864×416, gồm ba frame toàn thân 288×416, tạo bằng built-in imagegen từ ảnh tàu nguyên vẹn. Trạng thái lần lượt có 2, 4 và 6 vùng hỏng. Giáp rách, sườn kim loại, đường ống và phần máy móc tối bên trong đều có sẵn trong ảnh, không tạo bằng lỗ alpha ở runtime. Chọn một bộ và hướng lật một lần cho mỗi pha kết liễu, không chạy lặp các frame làm tàu nhấp nháy. Điểm nổ và mảnh vỡ bám vùng hỏng của ảnh; hai vùng trong cùng trạng thái cùng được mở sau vụ nổ.

Vùng thứ sáu chỉ là **một vết lẹm nhỏ ở mép một động cơ**. Ba đầu động cơ còn nguyên hình và vẫn sáng; vùng engine có bán kính hiệu ứng nhỏ hơn, chỉ ba mảnh vụn nhỏ, fire/pop nhỏ hơn. Không làm bay toàn bộ cụm động cơ. Hai hộ tống không nhận atlas hư hỏng.

Atlas được dựng từ sáu ảnh sinh riêng, chỉ crop/resize nearest-neighbor và xếp frame bằng `tools/asset-packs/boss-six/pack-hull-damage.py`. Prompt đầy đủ và nguồn nguyên bản: `hull-damage-atlas-sources.json` cùng thư mục. Manifest frame integer/region/hash: `assets/boss-six-ending/hull-damage-atlas.json`. Ảnh tổng hợp kiểm tra: `docs/boss-six-hull-damage-review.png`. Hull gốc và các bitmap cũ được giữ làm lịch sử, nhưng renderer/cache mới dùng hai atlas mới.

## Tích hợp và kiểm tra

Config mới: thời gian giữ 15 s, kill limit 10, vào/rút 2,4 s, gap 0,5 s, cap 30. Boss Lab ghi rõ quy tắc; nút Test reactor finale dùng 30 fighter để khớp cap mới. Script mới được nạp trước `dreadnought.js`; atlas mới được precache. Version/footer/package/lock/cache 44.38.0, ngày 21/11/2026. Không deploy, không sửa DB từ vựng, không cloud writes.

Kiểm tra tập trung: đủ bốn mẫu và số lượng, góc V 120°, khoảng cách không chồng, timer 15 giây, rút sau 10 fighter, không tính tàu rút thành tiêu diệt, đường rút liên tục, các hướng vào, xoay về người chơi, replay/co-op, lõi E và chuỗi kết thúc hiện có. Kiểm tra ảnh đã xem atlas tổng hợp; chưa xác nhận chuyển động trong trình duyệt thật do kết nối browser tool không hoạt động ở các lượt trước.
