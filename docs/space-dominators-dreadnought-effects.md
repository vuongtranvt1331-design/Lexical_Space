# Space Dominators — chuẩn hiệu ứng và âm thanh màn chiến hạm

Ngày nghiên cứu: 21/11/2026. Bản áp dụng: 44.38.0. Boss 6 cũ được thay bằng Dreadnought Assault, chơi được sau đoạn tiến công mũi tàu. Các thông số dưới đây là lựa chọn thiết kế của dự án, không phải số liệu sao chép từ game tham khảo.

## Nguồn nghiên cứu và cách vận dụng

| Nguồn gốc | Điều rút ra cho màn chơi này |
| --- | --- |
| [Ikaruga — nhà phát hành Nicalis](https://www.nicalis.com/games/ikaruga), [giới thiệu cơ chế polarity](https://blog.nicalis.com/blog/Ikaruga-Blasts-Its-Way-To-Nintendo-Switch-on-May-29/) | Màu đạn truyền đạt quy tắc tương tác. Ở đây dùng cyan/amber/magenta và hình dáng khác nhau để nhận diện; không thêm cơ chế hấp thụ đạn của Ikaruga. |
| [BulletML — Kenta Cho/ABA Games](https://www.asahi-net.or.jp/~cs8k-cyu/bulletml/index_e.html) | Tách mẫu đạn thành góc, tốc độ, thời gian và biến đổi; giữ dữ liệu mẫu riêng với renderer. Hữu ích cho quạt, vòng quay và tên lửa đổi hướng có thời hạn. |
| [The Art of Screenshake — Jan Willem Nijman, Dutch Game Garden](https://www.youtube.com/watch?v=AJdEqssNZ-U) | Phản hồi chiến đấu cần nhiều tín hiệu nhỏ: chớp sáng, nổ, mảnh vỡ và âm ngắn. Giới hạn rung để không che thông tin từ vựng. |
| [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) | Mở AudioContext bằng thao tác người dùng, tái sử dụng buffer, đưa âm qua gain chung; tôn trọng mute và chính sách autoplay. |

Thẩm mỹ trận chiến không gian lấy cảm hứng điện ảnh Star Wars; các file SFX mới ghép cho chiến đấu là bộ sci-fi tổng quát CC0, không phải âm thanh trích từ phim.

## Ngôn ngữ hình ảnh

Ảnh raster pixel 8-bit: giáp xám xanh, viền tối, lõi sáng, không làm mờ texture tàu. 20 PNG mới có alpha, tọa độ nguyên, khoảng đệm chống cắt mép. Bộ đế 128×128 và các đầu 128×128 dùng pivot khớp cơ khí đã đo theo từng đầu súng. Đầu xoay hướng lên ở góc 0; fighter nguyên bản hướng xuống. Không xoay đế theo đầu súng. Bảng mapping đầy đủ tại `apps/space-dominators/assets/sprites/manifest.json`; ảnh tổng hợp tại `docs/boss-six-sprite-review.png`.

Ưu tiên đọc: đạn nguy hiểm > đường báo bắn > mục tiêu > chi tiết giáp. Cảnh báo không gây sát thương; laser thật chỉ trúng trong thời gian khai hỏa. Đường ngắm laser khóa lúc bắt đầu sạc, không đuổi theo người chơi suốt pha sạc. Icon đỏ ở trên homing/shotgun/laser cho biết mục tiêu ưu tiên; vòng teal phân biệt Sprinkler bất tử. Người chơi có thể phá mọi ụ khác và tên lửa; các hạt năng lượng không phải mục tiêu bắn hạ.

## Các kỹ năng — đơn vị tọa độ scene 1280×720

| Loại | Sạc / hồi chiêu solo | Hành vi và phản hồi |
| --- | --- | --- |
| Fan wave | 0,4 / 3,8 giây | 7 hạt cyan, cách góc 0,14 rad, tốc độ 230 px/s. Quạt tập trung theo hướng khóa, có khe giữa từng viên; âm ngắn cho cả lượt bắn, không một tiếng mỗi hạt. |
| Expanding orb | 0,5 / 5,4 giây | 1 cầu amber, 188,6 px/s; bán kính từ 5 tăng 4 px mỗi giây, tối đa 27. Viền rõ cho biết vùng nguy hiểm tăng dần; sạc trầm lên cao rồi tiếng phóng nặng hơn. |
| Twin crossfire | 0,35 / 3,6 giây | 2 nòng lệch hai bên tâm 13 px; hai hướng chéo vào nhau ±0,07 rad, tốc độ 257,6 px/s. Một sprite đạn dùng hai lần, đầu súng và đạn cùng hướng. |
| Homing missile | 0,6 / 5,5 giây | 2 tên lửa; tốc độ đầu 195,5 px/s, tăng dần tối đa 312,8. Chỉ đổi hướng 0,7 giây đầu, giới hạn 0,65 rad/s; sau đó bay thẳng. Mỗi tên lửa 2 HP. Có tiếng khóa nhỏ trước tiếng phóng. |
| Shotgun missile | 0,7 / 6,8 giây | 5 tên lửa, cách góc 0,17 rad. Cùng giới hạn homing ngắn như trên, không truy đuổi vĩnh viễn. Một tiếng chùm, không 5 tiếng chồng cùng thời điểm. |
| Sprinkler | 0,075 / 0,625 giây | Đầu quay 0,72 rad/s, mỗi nhịp 4 hạt teal đồng thời, cách nhau 90° và xuất phát từ bốn nòng 161 px/s; đạn tồn tại tối đa 9 giây, đi đủ chiều cao màn hình. Bất tử, không có thưởng tiêu diệt. Nhịp âm nhỏ nhất. |
| Warning laser | 1,1 / 7 giây | Vạch magenta mảnh trong pha sạc; beam sáng rộng hơn khi khai hỏa 0,45 giây. Một beam chỉ gây sát thương một lần mỗi người chơi. Không có hai ụ laser cùng bắt đầu sạc. Âm nạp tăng cao độ, sau đó tiếng tia ngắn. |

Co-op: hồi chiêu và thời gian báo trước của boss 6 giống solo. Mỗi đợt bắn dựa trên trạng thái host và chuỗi random replay có sẵn; âm và render không quyết định gameplay.

## Đội hình, chuyển wave và giới hạn tải

- Intro: kéo xa 12 giây; 400 chấm màu rời ba chiến hạm từ giây 13 đến 17, hoàn thành đội hình trước 20,5 giây; giữ đến 23,5 rồi tiến vào mũi tàu trong 5 giây. Năm cụm V hướng xuống, mỗi cụm năm hàng, góc mở 120°. Không tạo 400 thực thể chiến đấu hoặc 200 kênh âm thanh.
- Sau giây 28,5 bắt đầu deck combat. Nền boong thay nền sao/hành tinh; ảnh được nối bằng các panel phản chiếu dọc, cuộn 38 px/s. Đây là giải pháp dùng panel hiện có, chưa phải bộ 5–6 nền độc lập được vẽ hoàn chỉnh.
- Lưới 3×12: 36 fighter, mỗi chiếc 6 HP, nhịp lượn nhẹ ±12 px. Không phát 36 âm nổ cùng lúc; chỉ phát những tiếng vượt qua cooldown/budget. Mỗi chiếc kiểm tra bắn ngẫu nhiên 13% sau khoảng 3,4–4,4 giây; một phần lượt bắn là tên lửa đuổi nhẹ.
- Mỗi 19 giây chuẩn bị một wave, báo trước 3 giây bằng mũi tên đỏ nhấp nháy tại cửa vào. Tuyến đi lần lượt ngang cong nhẹ, chéo có độ uốn, dọc mép trái, dọc mép phải. Chín fighter vào lệch nhau 0,15 giây, chặn hành lang đã báo; vẫn chừa vùng ngoài hành lang để né.
- Khi wave chuẩn bị hoặc đang bay, các ụ khác ngừng bắn; chỉ Sprinkler và hai loại ụ tên lửa còn hoạt động. Các viên đã phóng vẫn tiếp tục bay. Không xóa viên đang nhìn thấy để tạo cảm giác hụt.
- Tối đa 6 ụ, 42 fighter, 100 đạn (trong đó tối đa 14 tên lửa), 2 beam đang sống. Chưa có bằng chứng benchmark trên máy H81/4 GB; đây là giới hạn thiết kế, không phải cam kết FPS.
- Mục tiêu 100 địch solo, 150 địch tổng cộng khi co-op: fighter +1, ụ +1; tên lửa không cộng mục tiêu. Đủ số địch mở pha kết liễu lõi: đếm ngược 3 giây, bấm E trong 0,25 giây. Bỏ lỡ cần thêm 20/30 địch. Không có thời gian sống tối thiểu. Fighter/ụ cộng lần lượt 75/250 score qua hệ thống trận hiện có; không ghi cloud hoặc tạo hệ tiền riêng.

## Trúng đạn, nổ và tương tác

Bắn trúng dùng hiệu ứng nổ nhỏ dùng chung, tồn tại 0,18 giây, thêm âm chạm giáp ngắn. Khi phá fighter/turret, tăng kích thước nổ dùng chung, thêm mảnh vỡ tối; ụ có lớp nổ âm phụ sau 0,13 giây. Không tạo một atlas nổ riêng cho từng mục tiêu. Rung nhẹ tối đa khoảng 2 px, 0,06–0,14 giây chỉ ở lớp mục tiêu/đạn; tắt khi hệ thống yêu cầu giảm chuyển động. Chưa thêm lớp khói dài hoặc blur toàn màn hình vì làm khó đọc đường đạn.

Va chạm fighter làm nó nổ và gọi cơ chế mất mạng/hồi sinh hiện có. Người chơi không có khiên trong bản này: âm `playerDamage` là mất mạng, không phải mất khiên. Sau hồi sinh vẫn dùng khoảng bất tử một giây hiện hành. Phá tên lửa dùng nổ nhỏ và tiếng pop ngắn. Bắt đầu màn/đổi wave có tín hiệu riêng.

## Nguồn âm thanh và mapping

[Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) ghi giấy phép CC0; [trang hỗ trợ chính thức](https://kenney.nl/support) xác nhận tài nguyên asset CC0 dùng được không bắt buộc ghi công. Các OGG và `Kenney-License.txt` đã có trong dự án, được tái sử dụng trực tiếp để không nhân đôi dung lượng. Nguồn bổ sung đã kiểm tra: [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds), cũng CC0; chưa tải thêm vì bộ hiện tại đã đủ.

Manifest sự kiện: `apps/space-dominators/assets/sfx/manifest.json`. File `sfx-config.js` được sinh từ cùng cấu hình, nạp trước `sound.js`, không cần chờ fetch JSON để chơi. Đường dẫn file trong manifest tính từ thư mục `assets/sfx`.

| File OGG hiện có | Sự kiện ghép |
| --- | --- |
| laserSmall_000 | shoot, twinFire, sprinklerFire, fighterFire |
| laserRetro_001 | fanFire, laserFire |
| forceField_000 | fanCharge, twinCharge, orbCharge, orbFire, missileLock, laserCharge, priorityWarning, waveWarning |
| thrusterFire_000 | missileLaunch, shotgunLaunch |
| impactMetal_000 | armorHit, projectilePop |
| explosionCrunch_000 | fighterExplosion |
| lowFrequency_explosion_000 | turretExplosion |
| explosionCrunch_003 | turretSecondary, playerDamage |
| spaceEngineSmall_000 | fighterWave |
| engineCircular_001 | phaseChange |

Các sự kiện dùng chung một file vẫn có gain, độ dài, cooldown riêng; sạc orb/laser có playback-rate ramp 0,65→1,8. Nếu OGG lỗi tải/giải mã/chưa sẵn sàng, Web Audio phát oscillator hoặc noise ngắn theo đúng sự kiện; laser tổng hợp tăng 120→1250 Hz. Fallback không vượt mute/autoplay.

Combat có ngân sách chung 8 voice, giới hạn mỗi sự kiện 1–3 voice và cooldown 0,08–1 giây. Âm thường nhỏ hơn nổ; Sprinkler rất nhẹ. Giữ slider/mute sẵn có: gain cuối là volume × gain hiệu ứng chung, mặc định 0,5×0,1. Tắt âm về 0 sẽ triệt cả sample và synth. `silence()` dừng các voice khi tạm dừng/ẩn tab/rời màn. Những MP3 intro do người dùng cung cấp vẫn giữ luồng riêng tối đa năm lớp aircraft và không được gắn nhãn CC0; không tải thêm bản sao âm phim.

## Cách thử và giới hạn kiểm chứng

1. Từ thư mục gốc chạy `python -m http.server 8080`, mở `/apps/space-dominators/boss-practice.html?preview=6` trên localhost. Bấm Start nếu trình duyệt chặn âm khi tự mở bằng URL.
2. Chọn boss 6 / Full encounter. Xem đủ intro, vào boong và thử bắn fighter/ụ/tên lửa. Giữ trận đến ít nhất 75 giây combat để laser đủ điều kiện xuất hiện. Loại ụ được chọn ngẫu nhiên theo điều kiện mở khóa nên có thể cần chơi lại để gặp đủ bảy loại.
3. Mở Settings, kéo volume về 0 rồi tăng lại; pause/resume và đổi tab để kiểm tra không còn âm nền mắc kẹt.
4. Trong DevTools chặn URL `*.ogg` rồi tải lại và bấm Start: các cue combat vẫn phải có synth; cảnh báo phải nhìn thấy được ngay cả khi mute.
5. Mở Boss Lab with wingmate để kiểm tra cùng một đợt đội hình/hướng vào; hai máy cần tải cùng phiên bản.
6. Kiểm tra file: `python tools/asset-packs/boss-six/manage-assets.py check`. Kiểm tra logic: `node --test tests/space-dominators-flight.test.js tests/space-dominators-sound.test.js`.

Để nghe lần lượt đủ 24 cue mà không đợi random trong trận: mở Boss Lab, bấm vào trang để mở khóa âm, mở Console và chạy đoạn dưới. Nút mute/volume trong Boss Lab điều khiển cả lượt nghe thử; chạy `clearInterval(window.sfxAudition)` để dừng.

```js
clearInterval(window.sfxAudition);
const cues = Object.keys(SpaceSFXConfig.events);
window.sfxAudition = setInterval(() => {
  if (!cues.length) return clearInterval(window.sfxAudition);
  const cue = cues.shift(); console.log(cue); SpaceSound.play(cue);
}, 1400);
```

Đã kiểm thử bằng Node VM với asset/audio giả lập: đồng bộ combat hai peer, vào combat sau intro, trigger bảy loại súng, Sprinkler bất tử, thưởng không lặp, sample path tồn tại, synth khi offline, ramp sạc, cooldown/cap/mute/ẩn tab. Đây không thay cho nghe thử trên loa, kiểm tra hình ảnh trong trình duyệt thật hoặc chạy hai thiết bị qua mạng di động. Chưa triển khai lên web công khai.

Điều chỉnh 44.33.0: Sprinkler giữ một viên mỗi lượt; giảm nửa cả cooldown và pha chuẩn bị để nhịp bắn nhanh gấp đôi (chu kỳ solo 1,4 → 0,7 giây); siren intro giảm 70% gain (0,35 → 0,105), còn 30% mức trước.

Điều chỉnh 44.34.0: mỗi lượt Sprinkler khai hỏa cả bốn nòng cùng lúc; giữ chu kỳ bắn đã tăng gấp đôi. Một cue âm thanh cho cả lượt bắn. Nếu chạm giới hạn đạn, bỏ trọn lượt thay vì tạo chùm thiếu nòng.

Chi tiết kết liễu lõi, nổ dây chuyền và mảnh giáp có vận tốc: xem architecture-delta-44.36.0.md. Trong Boss Lab chọn boss 6 và bấm Test reactor finale để thử nhanh.

Bản 44.37.0: hình học sáu vết khuyết ngẫu nhiên (bốn ở mép, một đài chỉ huy, một động cơ); giữ toàn cảnh 4 giây với tàu người chơi rất nhỏ trước đài chỉ huy, rồi cắt về boong và hyperspace 0,8 giây. Xác suất fighter bắn 13%. Xem architecture-delta-44.37.0.md. Các đề xuất đội hình 20–30 chiếc và chu kỳ 15 giây / 10 địch mới chỉ thảo luận, chưa áp dụng.

Bản 44.38.0 đã áp dụng grid 30, ba khối 27, năm V 25 và năm kim cương 25; đổi đội sau 15 giây đứng đội hình hoặc hạ 10 fighter, rút theo đường vào và không tính tàu rút vào quota. Không còn lịch wave/grid cũ. Thân tàu hỏng dùng hai atlas ảnh thật có giáp rách và cơ cấu bên trong, bỏ khoét mask hình học; chỉ lẹm nhỏ ở một động cơ. Xem architecture-delta-44.38.0.md để có quy tắc hiện hành thay các mô tả lịch sử phía trên.
