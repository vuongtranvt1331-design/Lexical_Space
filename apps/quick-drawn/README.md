# Anh Hùng Hào Kiệt — hướng dẫn chạy

Chạy `run-local.bat` hoặc mở dự án qua máy chủ web. Chín tướng đều có sẵn, gồm Chu Văn An, Lạc Long Quân, Mai An Tiêm và Trần Quốc Toản; chạm vào nhân vật ở sảnh để đổi tướng. Mỗi tướng có trang phục mặc định và hai ô trang phục phụ đang khóa. Lựa chọn tướng được lưu trong localStorage của trình duyệt.

Chọn Đấu với máy để thi đấu tính điểm với một đối thủ có máu vô hạn. Máy tự phản đòn sau 7 giây ở câu đầu; thời gian giảm 0,2 giây mỗi câu và không thấp hơn 1,75 giây. Trả lời đúng được 1 điểm, trả lời sai bị đối thủ tấn công ngay. Chọn Song đấu để tạo phòng hoặc nhập mã phòng bốn số. Đấu mạng cần Internet để tải PeerJS và kết nối máy chủ báo hiệu; PeerJS sử dụng các máy chủ STUN/TURN mặc định; kết nối vẫn có thể thất bại nếu mạng hoặc dịch vụ trung gian bị chặn.

Trong PvP, mỗi bên bắt đầu với 10 cục máu; mỗi lượt giải đúng trừ đúng 1 HP dù hoạt ảnh có nhiều lần chạm. Trả lời sai khiến đối thủ tấn công. Trong PvC người chơi có 10 máu còn máy có máu vô hạn. Mỗi trận mới luân phiên hoàng cung, thao trường, đồng bằng và bến sông Bạch Đằng. Tạm dừng sẽ dừng bộ đếm và hoạt ảnh của hai phía. Khi hết máu, trận đấu kết thúc và hiện bảng Bá Vương cùng cảnh phóng to người thắng. Chọn Tái đấu để chơi lại; trong PvP cả hai người cần đồng ý và tiếp tục dùng cùng phòng.

Chủ phòng phân xử các đòn theo thứ tự đến và đồng bộ kết quả; độ trễ mạng có thể tạo lợi thế cho chủ phòng khi hai người bấm rất gần nhau. Phiên bản luyện từ cũ vẫn ở legacy.html.

## Âm thanh tùy chọn

Đặt các tệp sau vào `assets/audio/`, định dạng `.mp3` hoặc `.wav` (ưu tiên MP3): `shout_attack`, `sword_slash`, `elephant_charge`, `bow_shot`, `fall_defeat`, `tap_click`, `scroll_cast`, `fruit_throw`. Nếu thiếu hoặc không giải mã được tệp, game tổng hợp âm thanh thay thế bằng Web Audio. Âm tổng hợp không phải tiếng người hoặc voi được ghi âm.

## Từ vựng Lexical Space

Nhập tài khoản Lexical Space trong sảnh. Game đọc các từ hợp lệ có nghĩa và từ đồng nghĩa từ IndexedDB `LexicalSpaceDB` trên cùng trình duyệt và cùng địa chỉ web (giao thức, tên miền và cổng) với Lexical Space. Trong PvP, chủ phòng nạp bộ từ của mình và gửi từng câu hỏi cho khách. Nếu không tìm thấy bộ từ phù hợp tại địa chỉ hiện tại, game thông báo và dùng bộ từ mẫu. Dữ liệu IndexedDB của một trang không tự chia sẻ sang tên miền khác, kể cả giữa localhost và GitHub Pages.

## Cập nhật GitHub

Nhấp đúp `CAP-NHAT-GITHUB.bat` để đưa bản mới lên nhánh `main` của kho QuickDrawn. Lần đầu có thể phải đăng nhập GitHub trên trình duyệt; Git for Windows và GitHub CLI (`gh`) giúp đăng nhập tự động. Script không ép đẩy; nếu nhánh từ xa đã thay đổi ngoài bản đang có, script dừng để tránh ghi đè.

## Câu hỏi và bàn phím

Câu hỏi được xáo trộn thành từng vòng, chỉ lặp sau khi đã dùng hết các từ khác nhau và tránh lặp liên tiếp khi có ít nhất hai từ. Bộ từ chỉ có một từ hợp lệ vẫn phải lặp. Trong trận, bấm các phím 1, 2, 3 hoặc 4 để chọn đáp án tương ứng; phím không hoạt động khi đang tạm dừng hoặc nhập văn bản.

## Khắc phục PvP

Hai máy phải tải cùng phiên bản mới nhất, mở sảnh Song đấu và giữ chủ phòng đang chờ trước khi nhập mã. Nếu báo khác phiên bản, cập nhật rồi tải lại trang trên cả hai máy. Nếu kết nối quá lâu, thử mạng khác và kiểm tra truy cập PeerJS. Game chỉ vào trận sau khi hai phía đã xác nhận phiên bản và sẵn sàng.

Chu Văn An tấn công tầm xa bằng cuộn giấy; Mai An Tiêm ném dưa hấu, Trần Quốc Toản ném cam, còn Lạc Long Quân dùng cận chiến và có hào quang. Hai máy PvP cần tải cùng bản mới để chọn được hai tướng này.
