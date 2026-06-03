# Ý tưởng dự án: Phone Scanner Keyboard

## 1. Tóm tắt ý tưởng

**Phone Scanner Keyboard** là công cụ biến điện thoại thành máy quét mã vạch cho máy tính.

Người dùng không cần mua máy scan barcode chuyên dụng, không cần cài app mobile native, không cần đăng ký tài khoản và không cần cloud server.

Người dùng chỉ cần:

1. Mở **Desktop Tool** trên máy tính.
2. Dùng điện thoại scan QR từ tool.
3. Điện thoại mở **PWA Scanner**.
4. Dùng camera điện thoại scan barcode.
5. Barcode tự động được nhập vào ô đang focus trên máy tính.

Mục tiêu chính:

> Dùng điện thoại làm máy quét mã vạch cho máy tính. Scan xong tự nhập vào ô đang chọn như máy scan thật.

---

## 2. Vấn đề cần giải quyết

Nhiều cửa hàng nhỏ, kho hàng, quầy bán hàng hoặc người dùng cá nhân cần nhập barcode vào máy tính nhưng không muốn mua máy scan riêng.

Các vấn đề thường gặp:

- Máy scan barcode vật lý tốn tiền.
- Một số máy scan cần cài driver hoặc cấu hình.
- Người dùng đã có điện thoại có camera tốt nhưng chưa tận dụng được.
- Web/PWA trên điện thoại không thể tự nhập dữ liệu trực tiếp vào máy tính nếu không có công cụ hỗ trợ.
- Người dùng muốn dùng với nhiều phần mềm khác nhau như Web POS, Excel, Google Sheets, phần mềm kho, form nhập liệu.

Dự án này giải quyết bằng cách dùng:

- Điện thoại để scan barcode.
- Desktop Tool để nhận barcode và giả lập bàn phím.
- Kết nối local qua cùng mạng Wi-Fi.

---

## 3. Điểm khác biệt của ý tưởng

Dự án không phụ thuộc vào một Web POS cụ thể.

Nó hoạt động như một **máy scan barcode không dây**, vì Desktop Tool sẽ gõ dữ liệu vào ô đang focus trên máy tính.

Có thể dùng với:

- Web POS
- Excel
- Google Sheets
- Website bất kỳ
- Phần mềm quản lý kho
- Form nhập liệu
- Ô search sản phẩm
- Ô nhập barcode

Miễn là người dùng click vào đúng ô input trên máy tính, barcode sẽ được nhập vào đó.

---

## 4. Phạm vi MVP

MVP tập trung vào tính năng cốt lõi:

1. Desktop Tool chạy local server khi mở.
2. Desktop Tool hiển thị QR Code kết nối.
3. Điện thoại scan QR để mở PWA Scanner.
4. PWA dùng camera điện thoại để scan barcode.
5. PWA gửi barcode về Desktop Tool qua cùng mạng Wi-Fi.
6. Desktop Tool giả lập bàn phím và nhập barcode vào ô đang focus.
7. Có tùy chọn Auto Enter hoặc Auto Tab sau khi nhập.
8. Hiển thị lịch sử các barcode vừa scan.

---

## 5. Không làm trong MVP

Những phần chưa cần làm ở bản đầu:

- Không cần cloud server.
- Không cần đăng ký tài khoản.
- Không cần database online.
- Không cần app Android/iOS native.
- Không cần tích hợp trực tiếp với Web POS.
- Không cần Chrome Extension ở giai đoạn đầu.
- Không cần tự động tìm input `name="barcode"` trong website.

MVP chỉ cần hoạt động theo kiểu:

> Scan bằng điện thoại → gửi về tool → tool gõ vào ô đang focus.

---

## 6. Mô hình sản phẩm

```text
Phone PWA React Camera
   ↓ cùng mạng Wi-Fi
Desktop Tool trên máy tính
   ↓ local server trong tool
   ↓ keyboard injector
Gõ barcode vào ô đang focus
```

---

## 7. Người dùng mục tiêu

Dự án phù hợp cho:

- Cửa hàng nhỏ
- Quầy bán hàng
- Kho hàng nhỏ
- Người nhập liệu sản phẩm
- Người dùng Excel/Google Sheets
- Chủ shop online
- Người muốn dùng điện thoại thay máy scan barcode

---

## 8. Giá trị chính

Giá trị của sản phẩm:

- Tiết kiệm chi phí mua máy scan.
- Không cần cài app mobile.
- Không cần đăng ký tài khoản.
- Không cần server cloud.
- Dễ dùng: mở tool, scan QR, dùng ngay.
- Dùng được với nhiều phần mềm khác nhau.
- Hoạt động qua kết nối Wi-Fi local.

---

## 9. Câu định vị sản phẩm

Câu ngắn:

> Biến điện thoại thành máy quét mã vạch cho máy tính.

Câu đầy đủ:

> Phone Scanner Keyboard giúp người dùng dùng camera điện thoại để scan barcode và tự động nhập mã vào ô đang chọn trên máy tính như một máy scan barcode thật, không cần app mobile, không cần tài khoản và không cần cloud server.

---

## 10. Tên project đề xuất

Tên kỹ thuật cho repo:

```text
phone-scanner-keyboard
```

Tên sản phẩm có thể dùng:

```text
Phone Scanner Keyboard
Mobile Barcode Keyboard
Scan-to-Input Tool
Orderdee Scan Keyboard
```
