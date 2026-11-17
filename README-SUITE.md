# LexicalSpace / SpaceSuite 43.19.0

Bản tích hợp ngày 17/11/2026. Mở LexicalSpace làm app chính; GrammarSpace và ArcadeSpace chạy bên trong cùng phạm vi cài đặt. ArcadeSpace mở QuickDrawn/cờ vua, Sky Dominators và Poker. Các phần vẫn có mã nguồn, giao diện và tài nguyên riêng.

## Chạy trên máy

Nháy đúp **run-local.bat** (hoặc start-localhost.bat). Cần Python 3; không cần cài các gói Node để chơi. Mở **http://localhost:8000/** và giữ cửa sổ chạy local mở. Không mở index.html bằng file://.

Nếu cổng 8000 đang được một server cũ sử dụng, đóng cửa sổ server đó trước. Bộ chạy báo rõ lỗi và không tự kết nối vào nhầm thư mục. Có thể dùng `python run-local.py --port 8001`, nhưng cổng khác là nơi lưu dữ liệu trình duyệt khác; nên giữ nguyên localhost:8000 để tiếp tục đọc thư viện local đang có.

## Thư mục

```text
index.html + css/ + js/ + assets/     LexicalSpace chính
teacher/                            Công cụ giáo viên hiện có
apps/grammar/                       Thư viện và sổ bài học GrammarSpace
apps/arcade/                        ArcadeSpace, CSS/JS đã tách khỏi HTML
apps/quick-drawn/                    Word Battles, danh tướng và cờ vua
apps/sky-dominators/                 Game máy bay và tài nguyên riêng
apps/poker/                         Poker từ vựng, CSS/JS đã tách khỏi HTML
suite/js/core.js                    Điều hướng và đọc hồ sơ chung
suite/components/profile.js         Hiển thị hồ sơ trong GrammarSpace
suite/css/                          Loader, nhận diện và thành phần dùng chung
apps/arcade/assets/                 Logo A, thương hiệu Hub và atlas icon 24
js/features/loading.js              Một bộ điều khiển loader cho Lexical/Grammar/Arcade
manifest.webmanifest                 Một nhận diện app cài đặt
service-worker.js                    Một bộ nhớ đệm cho toàn bộ app
tools/build-suite.py                 Cập nhật dấu phiên bản và cache sau khi sửa nguồn
docs/suite-baseline.json             Bản đồ hợp đồng và SHA-256 để đối chiếu
```

## Điều hướng và animation

- Dùng `SpaceSuite.href(name, {mode, topic})` hoặc `SpaceSuite.go(...)`; tên phần là lexical, grammar, arcade, quick-drawn, sky-dominators, poker.
- Các đường dẫn tự theo thư mục deploy. Bản này chạy cả tại `/` trên localhost và `/Lexical_Space/` trên GitHub Pages. Không nối lồng returnUrl; link trở về chỉ nhận trang nội bộ hợp lệ.
- Lexical, Grammar và Arcade dùng chung loader gõ chữ của Lexical, không phát âm thanh. Loader kết thúc khi dữ liệu sẵn sàng, có hỗ trợ giảm chuyển động. Grammar chờ danh sách bài học; Arcade chờ bộ từ.
- Ba game dùng `suite/components/game-logo-loader.js` + `suite/css/game-logo-loader.css`: logo đã tải ở ArcadeSpace nhấp nhẹ 3px trong khi khởi tạo tài nguyên cục bộ. Không có intro/audio khởi động hoặc thời gian chờ bắt buộc. Logo bộ B chỉ ở menu/lobby; Poker không có logo cố định trên bàn.

## Hồ sơ và dữ liệu

`sessionStorage.ls_active_profile` có ưu tiên cao nhất, kể cả chuỗi rỗng khi đã đăng xuất. Sau đó mới dùng `localStorage.vocab_user` và tham số user của đường dẫn. Lớp ghép không ghi bộ từ. Poker lưu riêng hạn mức trợ giúp theo hồ sơ tại `wildWestPoker_assists_v1:<username đã encode>`; không sửa schema LexicalSpaceDB.

- Lexical tiếp tục sở hữu LexicalSpaceDB phiên bản 3 và việc đồng bộ words/metadata/activity_logs theo mã hiện có. Game chỉ đọc words, không mở nâng cấp hoặc thay schema.
- Grammar hiển thị hồ sơ chung nhưng giữ nguyên nơi lưu bài học/tiến độ local hiện có. Bản này không tự gán tiến độ vô danh cho tài khoản và không thêm đồng bộ cloud cho tiến độ Grammar.
- QuickDrawn giữ nguyên Elo, standings, hàng đợi offline, Firestore home-page-d6c39 và quy tắc PvP/cờ vua. Cả 47 DOM ID, state, PeerJS và hợp đồng dữ liệu được giữ nguyên; chỉ nhận diện và loader được cập nhật.
- Sky giữ backend tiến độ skydominators, tiền/phi cơ/skin và kết quả cũ. Hồ sơ học viên dùng tên chung; khách vẫn có biệt danh phi công riêng. Không chuyển dữ liệu Sky sang một dự án Firebase khác.
- Poker giữ luật chơi và cách đọc bộ từ hiện tại, không thêm cloud writes.

Dữ liệu local phụ thuộc địa chỉ và nơi cài app. Các app đã cài riêng, đặc biệt trên iOS, có thể có kho dữ liệu riêng; bản tích hợp không tự lấy dữ liệu từ kho cài đặt khác. Giữ các app cũ cho đến khi đã kiểm tra dữ liệu cần dùng.

## Đưa lên mạng và cập nhật app đã cài

Đưa **toàn bộ nội dung thư mục này** lên đúng địa chỉ LexicalSpace hiện tại. Không chỉ đưa riêng index.html, không triển khai mỗi thư mục con thành một app khác. `.nojekyll` được giữ để GitHub Pages phục vụ các tệp tĩnh.

Giữ `id`, `start_url`, `scope` của manifest là `./`. Các trang con đều dùng manifest và worker gốc. Bản LexicalSpace đã cài trên Android/iOS có thể nhận mã mới khi có mạng; nếu chưa thấy thay đổi, đóng hẳn và mở lại. Biểu tượng Grammar/Arcade đã cài riêng không tự nhập thành một biểu tượng. Không cần gỡ LexicalSpace để cập nhật.

Worker chỉ dọn các cache shell cũ của chính phạm vi này; không xóa IndexedDB, localStorage hay cache của app khác. Tài nguyên ảnh/âm thanh lớn được lưu khi sử dụng; một game chưa mở đủ tài nguyên lần đầu chưa bảo đảm chơi được hoàn toàn offline. PvP, bảng xếp hạng cloud và API vẫn cần mạng. App không tự tải lại giữa trận khi có bản mới.

## Bảo trì

Sau khi sửa nguồn: cập nhật phiên bản/footer/ngày theo AGENTS.md, chạy `python tools/build-suite.py`, rồi `npm ci` và `npm test` nếu sửa logic. Bộ build đọc phiên bản từ package.json, gắn dấu nội dung vào các tài nguyên tích hợp đã đổi và tạo lại cache từ nguồn. Không sửa service-worker.js bằng tay. Không chạy các script chuẩn bị bản ghép lịch sử trong workspace lên bản đã bàn giao.

Bản này chưa được push hoặc deploy. Việc kiểm thử trình duyệt dùng dữ liệu mẫu; không thay thế kiểm thử cài đặt trên thiết bị Android/iOS thật.


## Cập nhật 43.4.0 — 2026-11-18

ArcadeSpace dùng một hàng game vuông, mũi tên/swipe vòng lặp, không có chấm phân trang; âm thanh trong Settings. Logo A cho thẻ Hub, logo B cho menu game. Icon chung dùng atlas 24.

Poker: chọn cặp theo thứ tự tự do; 5 chip đầu, thắng từ 12, thua ở 0. Đúng +1, sai -1; streak hai cặp +1 một lần/vòng, hoàn hảo bốn cặp +2. Hiện nghĩa Việt và phát âm tiếng Anh khi đúng. Bộ thẻ ngang số 2 có bốn chất và một mặt sau. Hint/Reshuffle bắt đầu được cấp ở vòng hoàn thành 10, rồi 30/50/70…; tính riêng từng quyền, giữ lượt chưa dùng theo hồ sơ.

Dọn file chỉ sau khi hoàn tất tính năng; giữ core IDB/sync/SRS, tất cả entry hiện hành, bộ kiểm tra đang dùng, runtime catalog/skin/boss, README và baseline. Xem báo cáo dọn dẹp cùng bản đồ delta để biết danh sách xóa và hash mới.

## 43.5.0 — 2026-11-18

Wild West Poker now fits each hand to the available screen, with four cards across on wide displays. Correct pairs show their meaning before turning face down.

## 43.6.0 — 2026-11-18

The dealer calls one random unmatched word. Choose its synonym from the lower hand. Hint and Reshuffle cost 2 chips on any playable turn. Spending the last 2 chips keeps the match alive. A wrong answer that leaves zero chips ends it.

## 43.9.0 — Game menus and Poker scoring

The main menu of each game ends with a labeled Arcade Hub button. Wild West Poker opens on its casino menu, deals on Enter, and charges two chips for a wrong synonym. Spending the last two chips on an assist still allows the player to continue. Poker pause preserves the remaining time on the deal and turn feedback. The personal chess menu leaves the match clock running.

Game-themed PNG sheets provide four states for labeled actions. Live chess uses four toolbar slots for resignation, draw offers and replies, and personal pause.

## 43.8.0 — 2026-11-18

Game system actions use transparent pixel icons across all three games. Keyboard focus, pointer hover and press highlight the glyph.

## 43.7.0 — 2026-11-18

Sky Dominators uses a full mobile field, floating left stick, manual fire up to five volleys per second, safe-area HUD and a right-hand skill control. Arcade return controls share the Hub exit art across games. Removed the remaining obsolete cowboy audio notice and score-key declaration from Word Battles.
