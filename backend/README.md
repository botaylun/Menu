# 🍦 HƯỚNG DẪN CÀI ĐẶT & CHẠY BACKEND MONGODB CHO MINTYMART

Hệ thống Backend được xây dựng bằng **Node.js, Express và MongoDB (Mongoose)**, cung cấp đầy đủ API quản lý danh mục kem, khu vực và phân quyền Quản trị viên (Admin).

---

## 🚀 1. Chuẩn bị Cơ sở dữ liệu MongoDB

Bạn có thể sử dụng 1 trong 2 cách:
- **Cách 1: MongoDB Local** (Cài đặt MongoDB Community Server trên máy tính):
  - Chuỗi kết nối: `mongodb://127.0.0.1:27017/mintymart`
- **Cách 2: MongoDB Atlas Cloud** (Miễn phí, khuyến nghị):
  - Tạo tài khoản tại [mongodb.com/atlas](https://www.mongodb.com/atlas).
  - Lấy chuỗi kết nối dạng: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/mintymart?retryWrites=true&w=majority`

Mở file `backend/.env` và cập nhật biến `MONGODB_URI` tương ứng.

---

## 📦 2. Cài đặt Thư viện

Mở Terminal tại thư mục `backend`:
```bash
cd backend
npm install
```

---

## 🌿 3. Nạp dữ liệu ban đầu vào MongoDB (Seeding)

Chạy lệnh sau để tự động trích xuất toàn bộ dữ liệu khu vực và món kem có sẵn nạp thẳng vào MongoDB:
```bash
npm run seed
```
> Lệnh này sẽ tự động khởi tạo luôn tài khoản Admin mặc định:
> - **Tên đăng nhập:** `mintymart`
> - **Mật khẩu:** `123456`

---

## ⚡ 4. Khởi chạy Backend Server

Để chạy server ở chế độ thường:
```bash
npm start
```

Để chạy server ở chế độ phát triển (tự động reload khi sửa code):
```bash
npm run dev
```

Server sẽ lắng nghe tại: **`http://localhost:5000`**

---

## 📑 5. Danh sách các API Endpoint

### 🍦 Menu & Sản phẩm (Public & Admin):
- `GET /api/menu` - Lấy toàn bộ danh mục kem và khu vực cho trang sách lật FlipBook.
- `GET /api/items` - Lấy danh sách món kem (hỗ trợ tìm kiếm `?q=kem`, lọc khu vực `?zone=kr`, lọc hãng `?brand=Binggrae`).
- `GET /api/items/:id` - Xem chi tiết 1 món kem.
- `POST /api/items` - Thêm món kem mới (Yêu cầu Token Admin).
- `PUT /api/items/:id` - Sửa món kem (Yêu cầu Token Admin).
- `DELETE /api/items/:id` - Xóa món kem (Yêu cầu Token Admin).

### 🌍 Khu vực kem (Zones):
- `GET /api/zones` - Xem danh sách khu vực.
- `POST /api/zones` - Thêm khu vực mới (Yêu cầu Token Admin).
- `PUT /api/zones/:key` - Đổi tên / sửa khu vực (Yêu cầu Token Admin).
- `DELETE /api/zones/:key` - Xóa khu vực (Yêu cầu Token Admin).

### 🔐 Quản trị & Xác thực (Auth):
- `POST /api/auth/login` - Đăng nhập tài khoản Admin (nhận JWT Token).
- `GET /api/auth/me` - Kiểm tra thông tin Admin đang đăng nhập.
- `POST /api/auth/change-password` - Đổi mật khẩu Admin.
