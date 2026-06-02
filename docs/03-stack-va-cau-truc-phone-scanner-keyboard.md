# Stack và cấu trúc project: Phone Scanner Keyboard

## 1. Stack chốt cuối cùng

Dự án gồm 2 phần chính:

1. **Desktop Tool** chạy trên máy tính.
2. **Phone PWA Scanner** chạy trên điện thoại.

Stack chốt:

```text
Desktop Tool:
Electron + Node.js + Fastify + Socket.IO + QRCode + nut.js + TypeScript

Phone PWA:
React + Vite + TypeScript + vite-plugin-pwa + @zxing/browser + Socket.IO Client

Workspace:
pnpm workspace + shared package
```

---

## 2. Desktop Tool stack

### Công nghệ sử dụng

```text
Electron
Node.js
Fastify
Socket.IO
QRCode
nut.js
TypeScript
```

### Vai trò từng công nghệ

| Công nghệ | Vai trò |
|---|---|
| Electron | Đóng gói thành Desktop Tool chạy trên Windows/macOS/Linux |
| Node.js | Runtime chính cho logic desktop tool |
| Fastify | Tạo local server để điện thoại kết nối |
| Socket.IO | Giao tiếp realtime giữa PWA và Desktop Tool |
| QRCode | Tạo mã QR chứa IP/port/token |
| nut.js | Giả lập bàn phím để gõ barcode vào ô đang focus |
| TypeScript | Code rõ ràng, dễ bảo trì, dùng chung type |

### Nhiệm vụ của Desktop Tool

Desktop Tool cần làm các việc sau:

```text
1. Mở local server khi tool chạy.
2. Lấy IP local của máy tính.
3. Tạo token kết nối tạm thời.
4. Tạo QR Code kết nối.
5. Host trang PWA Scanner local.
6. Nhận barcode từ điện thoại.
7. Giả lập bàn phím nhập barcode vào ô đang focus.
8. Hỗ trợ Auto Enter / Auto Tab.
9. Hiển thị trạng thái kết nối.
10. Hiển thị lịch sử barcode gần nhất.
```

---

## 3. Phone PWA stack

### Công nghệ sử dụng

```text
React
Vite
TypeScript
vite-plugin-pwa
@zxing/browser
Socket.IO Client
```

### Vai trò từng công nghệ

| Công nghệ | Vai trò |
|---|---|
| React | Xây dựng giao diện scanner trên điện thoại |
| Vite | Build nhanh, nhẹ, phù hợp MVP |
| TypeScript | Code rõ ràng và đồng bộ type với Desktop Tool |
| vite-plugin-pwa | Biến web scanner thành PWA |
| @zxing/browser | Đọc barcode/QR bằng camera trình duyệt |
| Socket.IO Client | Gửi barcode realtime về Desktop Tool |

### Camera trong React

React không tự có camera, nhưng React component sẽ dùng Browser Camera API kết hợp với `@zxing/browser`.

Flow camera:

```text
React component mount
   ↓
Xin quyền camera
   ↓
Ưu tiên camera sau
   ↓
Lấy video stream
   ↓
ZXing đọc barcode từ video stream
   ↓
Có barcode thì gửi về Desktop Tool
```

Barcode nên hỗ trợ trong MVP:

```text
EAN-13
EAN-8
UPC-A
UPC-E
Code 128
Code 39
QR Code
```

---

## 4. Vì sao chọn stack này

### Vì sao dùng Electron?

Electron dễ làm MVP vì dùng JavaScript/TypeScript và Node.js.

Ưu điểm:

- Dễ đóng gói thành app desktop.
- Dễ chạy local server.
- Dễ dùng thư viện Node.js.
- Phù hợp với người quen web stack.

Sau này nếu cần app nhẹ hơn có thể cân nhắc Tauri, nhưng MVP nên dùng Electron để làm nhanh.

---

### Vì sao dùng Fastify?

Fastify dùng để tạo local server trong Desktop Tool.

Ưu điểm:

- Nhẹ.
- Nhanh.
- Cấu trúc rõ.
- Dễ tạo API nhận barcode.

Ví dụ route:

```text
GET /scan
POST /input
GET /health
```

---

### Vì sao dùng Socket.IO?

Socket.IO giúp kết nối realtime giữa điện thoại và Desktop Tool.

Dùng cho:

- Trạng thái Connected/Disconnected.
- Gửi barcode realtime.
- Gửi phản hồi scan thành công.
- Kiểm tra kết nối.

Nếu muốn đơn giản hơn, MVP có thể chỉ dùng HTTP POST. Nhưng Socket.IO sẽ tốt hơn cho trải nghiệm realtime.

---

### Vì sao dùng @zxing/browser?

`@zxing/browser` hỗ trợ nhiều loại barcode và chạy tốt trên browser.

Dùng để scan:

- Barcode sản phẩm.
- QR connect.
- Các mã phổ biến trong bán hàng/kho hàng.

---

### Vì sao dùng nut.js?

`nut.js` dùng để giả lập bàn phím.

Nó giúp Desktop Tool nhập barcode vào ô đang focus như người dùng đang gõ thật.

Ví dụ:

```text
Barcode: 8938505974193
Tool typing: 8938505974193
Tool press: Enter nếu bật Auto Enter
```

---

## 5. Cấu trúc project đề xuất

```text
phone-scanner-keyboard/
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── main/
│   │   │   │   ├── index.ts
│   │   │   │   ├── create-window.ts
│   │   │   │   └── app-menu.ts
│   │   │   │
│   │   │   ├── server/
│   │   │   │   ├── start-server.ts
│   │   │   │   ├── routes.ts
│   │   │   │   ├── socket.ts
│   │   │   │   └── token.ts
│   │   │   │
│   │   │   ├── network/
│   │   │   │   ├── get-local-ip.ts
│   │   │   │   └── port.ts
│   │   │   │
│   │   │   ├── qr/
│   │   │   │   └── generate-qr.ts
│   │   │   │
│   │   │   ├── keyboard/
│   │   │   │   ├── type-text.ts
│   │   │   │   ├── press-enter.ts
│   │   │   │   └── press-tab.ts
│   │   │   │
│   │   │   ├── store/
│   │   │   │   └── settings.ts
│   │   │   │
│   │   │   └── renderer/
│   │   │       ├── App.tsx
│   │   │       ├── components/
│   │   │       │   ├── QrCard.tsx
│   │   │       │   ├── StatusBadge.tsx
│   │   │       │   ├── SettingsPanel.tsx
│   │   │       │   └── ScanHistory.tsx
│   │   │       └── styles.css
│   │   │
│   │   ├── package.json
│   │   └── electron-builder.yml
│   │
│   └── scanner-pwa/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── ConnectPage.tsx
│       │   │   └── ScannerPage.tsx
│       │   ├── components/
│       │   │   ├── CameraScanner.tsx
│       │   │   ├── ConnectionStatus.tsx
│       │   │   └── LastBarcode.tsx
│       │   ├── hooks/
│       │   │   ├── useBarcodeScanner.ts
│       │   │   └── useSocketConnection.ts
│       │   ├── lib/
│       │   │   ├── socket.ts
│       │   │   └── scanner.ts
│       │   └── styles.css
│       │
│       ├── public/
│       │   ├── manifest.webmanifest
│       │   └── icons/
│       │
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types.ts
│       │   ├── constants.ts
│       │   └── events.ts
│       └── package.json
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

---

## 6. Shared types đề xuất

File:

```text
packages/shared/src/types.ts
```

Ví dụ type:

```ts
export type ConnectionStatus = 'waiting' | 'connected' | 'disconnected'

export type ScanPayload = {
  token: string
  value: string
  type: 'barcode' | 'qr'
  timestamp: number
}

export type ToolSettings = {
  autoEnter: boolean
  autoTab: boolean
  typingDelayMs: number
  suffix: 'none' | 'enter' | 'tab'
}
```

---

## 7. Socket event đề xuất

File:

```text
packages/shared/src/events.ts
```

Event chính:

```ts
export const SOCKET_EVENTS = {
  CONNECT_PHONE: 'phone:connect',
  PHONE_CONNECTED: 'phone:connected',
  PHONE_DISCONNECTED: 'phone:disconnected',
  BARCODE_SCANNED: 'barcode:scanned',
  BARCODE_RECEIVED: 'barcode:received',
  ERROR: 'error',
} as const
```

---

## 8. API route local đề xuất

Desktop Tool chạy local server với các route:

```text
GET  /health
GET  /scan?token=ABC123
POST /input
GET  /settings
POST /settings
```

### GET /health

Dùng để kiểm tra local server còn chạy không.

Response:

```json
{
  "ok": true,
  "app": "phone-scanner-keyboard"
}
```

### GET /scan

Trả về trang PWA Scanner hoặc redirect đến scanner page.

Ví dụ:

```text
http://192.168.1.10:8787/scan?token=ABC123
```

### POST /input

Nhận barcode từ điện thoại.

Request:

```json
{
  "token": "ABC123",
  "value": "8938505974193",
  "type": "barcode",
  "timestamp": 1780350000000
}
```

---

## 9. Cấu hình MVP Desktop Tool

Settings cần có:

```text
Auto Enter: On/Off
Auto Tab: On/Off
Suffix: None / Enter / Tab
Typing Delay: 0ms / 10ms / 30ms
Port: 8787
Connection Mode: Wi-Fi / USB tethering
```

---

## 10. Package cài đặt đề xuất

### Root workspace

```bash
pnpm init
pnpm add -D typescript
```

### Desktop Tool

```bash
pnpm add electron fastify socket.io qrcode @nut-tree/nut-js
pnpm add -D electron-builder tsx @types/node
```

### Scanner PWA

```bash
pnpm add react react-dom @zxing/browser socket.io-client
pnpm add -D vite vite-plugin-pwa typescript @vitejs/plugin-react
```

---

## 11. MVP checklist

### Desktop Tool

```text
[ ] Mở app Electron được.
[ ] Chạy local server khi mở app.
[ ] Lấy được IP local.
[ ] Tạo được QR Code.
[ ] Host được PWA Scanner.
[ ] Nhận được kết nối từ điện thoại.
[ ] Nhận barcode từ điện thoại.
[ ] Gõ barcode vào ô đang focus.
[ ] Bật/tắt Auto Enter.
[ ] Hiển thị lịch sử 10 barcode gần nhất.
```

### Phone PWA

```text
[ ] Mở được từ QR.
[ ] Xin quyền camera.
[ ] Ưu tiên camera sau.
[ ] Scan được barcode.
[ ] Gửi barcode về Desktop Tool.
[ ] Hiển thị trạng thái Connected.
[ ] Hiển thị barcode vừa scan.
[ ] Có nút gửi lại barcode cuối.
```

---

## 12. Chốt cuối

Stack chính thức:

```text
Electron + Node.js + Fastify + Socket.IO + QRCode + nut.js
React + Vite + PWA + ZXing Browser
TypeScript + pnpm workspace
```

Flow chính thức:

```text
Phone PWA React Camera
   ↓ scan barcode bằng camera
Socket.IO qua cùng Wi-Fi / USB tethering
   ↓
Desktop Tool local server
   ↓
nut.js keyboard injection
   ↓
Gõ barcode vào ô đang focus
```
