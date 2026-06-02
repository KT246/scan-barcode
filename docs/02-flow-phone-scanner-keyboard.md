# Flow dự án: Phone Scanner Keyboard

## 1. Flow tổng quan

```text
Phone PWA React Camera
   ↓ cùng Wi-Fi / USB tethering
Desktop Tool trên máy tính
   ↓ local server trong tool
   ↓ keyboard injector
Gõ barcode vào ô đang focus
```

Dự án hoạt động theo mô hình local.

Không cần cloud server, không cần đăng ký tài khoản, không cần app mobile native.

---

## 2. Flow người dùng cuối

```text
1. Người dùng tải Desktop Tool về máy tính.
2. Người dùng mở Desktop Tool.
3. Tool tự chạy local server trên máy tính.
4. Tool lấy IP local của máy tính.
5. Tool tạo QR Code chứa link kết nối.
6. Người dùng dùng điện thoại scan QR Code.
7. Điện thoại mở PWA Scanner.
8. PWA xin quyền camera.
9. Người dùng click vào ô input trên máy tính.
10. Điện thoại scan barcode.
11. PWA gửi barcode về Desktop Tool.
12. Desktop Tool nhận barcode.
13. Desktop Tool giả lập bàn phím.
14. Barcode được nhập vào ô đang focus trên máy tính.
```

---

## 3. Flow mở Desktop Tool

Khi người dùng mở Desktop Tool:

```text
Mở Desktop Tool
   ↓
Khởi động local server
   ↓
Lấy IP máy tính trong mạng local
   ↓
Tạo token kết nối tạm thời
   ↓
Tạo QR Code
   ↓
Hiển thị QR trên màn hình tool
```

Ví dụ local server chạy tại:

```text
http://0.0.0.0:8787
```

Ví dụ IP máy tính trong Wi-Fi:

```text
192.168.1.10
```

Ví dụ QR chứa link:

```text
http://192.168.1.10:8787/scan?token=ABC123
```

---

## 4. Flow kết nối điện thoại với Desktop Tool

```text
Điện thoại scan QR
   ↓
Mở link local từ QR
   ↓
PWA Scanner load từ Desktop Tool
   ↓
PWA gửi request xác thực token
   ↓
Desktop Tool kiểm tra token
   ↓
Kết nối thành công
   ↓
Hiển thị trạng thái Connected
```

Điện thoại và máy tính phải ở cùng mạng:

- Cùng Wi-Fi
- Hoặc USB tethering

---

## 5. Flow scan barcode

```text
PWA mở camera
   ↓
Ưu tiên camera sau của điện thoại
   ↓
ZXing đọc barcode từ video stream
   ↓
Khi phát hiện barcode hợp lệ
   ↓
PWA gửi barcode về Desktop Tool
```

Ví dụ barcode đọc được:

```text
8938505974193
```

Payload gửi về tool có thể là:

```json
{
  "token": "ABC123",
  "value": "8938505974193",
  "type": "barcode",
  "timestamp": 1780350000000
}
```

---

## 6. Flow Desktop Tool nhận barcode

```text
Desktop Tool nhận barcode
   ↓
Kiểm tra token
   ↓
Kiểm tra trạng thái kết nối
   ↓
Thêm barcode vào lịch sử scan
   ↓
Gọi keyboard injector
   ↓
Gõ barcode vào ô đang focus
   ↓
Nếu bật Auto Enter thì bấm Enter
   ↓
Nếu bật Auto Tab thì bấm Tab
```

Ví dụ kết quả trên máy tính:

```text
8938505974193
```

Nếu bật Auto Enter:

```text
8938505974193 + Enter
```

---

## 7. Flow nhập vào ô đang focus

Người dùng cần click vào ô cần nhập trên máy tính trước.

Ví dụ:

```text
[ input barcode đang focus ]
```

Sau đó điện thoại scan barcode, tool sẽ giả lập như người dùng đang gõ bàn phím.

Tool không cần biết website/app đang mở là gì.

Có thể nhập vào:

- Web POS
- Excel
- Google Sheets
- Form HTML
- Phần mềm kho
- Ô tìm kiếm sản phẩm
- Ô nhập barcode bất kỳ

---

## 8. Flow qua Wi-Fi

```text
Điện thoại và máy tính cùng Wi-Fi
   ↓
Desktop Tool chạy local server
   ↓
Điện thoại mở link local từ QR
   ↓
PWA gửi barcode qua Wi-Fi
   ↓
Tool nhận barcode và gõ vào máy tính
```

Điều kiện:

- Điện thoại và máy tính cùng mạng.
- Wi-Fi không bật Client Isolation/AP Isolation.
- Firewall trên máy tính cho phép tool nhận kết nối local.

---

## 9. Flow qua USB tethering

```text
Cắm điện thoại vào máy tính bằng USB
   ↓
Bật USB tethering trên điện thoại
   ↓
Điện thoại và máy tính có mạng nội bộ qua USB
   ↓
Tool tạo QR với IP phù hợp
   ↓
Điện thoại mở PWA Scanner
   ↓
Scan barcode và gửi về tool
```

USB tethering dùng khi:

- Wi-Fi không ổn định.
- Wi-Fi chặn thiết bị thấy nhau.
- Người dùng muốn kết nối ổn định hơn.

---

## 10. Flow lỗi thường gặp

### Lỗi 1: Điện thoại không mở được link QR

Nguyên nhân có thể:

- Không cùng Wi-Fi.
- IP máy tính sai.
- Firewall chặn port.
- Tool chưa chạy local server.

Cách xử lý:

- Kiểm tra điện thoại và máy tính cùng Wi-Fi.
- Thử dùng USB tethering.
- Cho phép Desktop Tool qua Windows Firewall.
- Restart tool.

---

### Lỗi 2: Camera không mở được

Nguyên nhân có thể:

- Người dùng chưa cấp quyền camera.
- Browser không hỗ trợ tốt.
- Trang local HTTP bị browser giới hạn trên một số thiết bị.

Cách xử lý:

- Cấp quyền camera.
- Dùng Chrome trên Android.
- Nếu cần, sau này có thể thêm HTTPS local hoặc cloud fallback.

---

### Lỗi 3: Barcode không nhập vào máy tính

Nguyên nhân có thể:

- Người dùng chưa click vào ô input.
- Keyboard injector lỗi quyền.
- Tool mất kết nối với PWA.
- Auto Enter/Tab cấu hình sai.

Cách xử lý:

- Click vào ô input trước khi scan.
- Kiểm tra trạng thái Connected.
- Thử nhập test từ Desktop Tool.
- Restart Desktop Tool.

---

## 11. Flow MVP chốt cuối

```text
1. Mở Desktop Tool.
2. Tool chạy local server.
3. Tool hiện QR.
4. Điện thoại scan QR.
5. Điện thoại mở PWA Scanner.
6. PWA mở camera bằng React component.
7. Người dùng click ô input trên máy tính.
8. Điện thoại scan barcode.
9. PWA gửi barcode về tool qua Wi-Fi/USB tethering.
10. Tool dùng keyboard injector để gõ barcode vào ô đang focus.
```
