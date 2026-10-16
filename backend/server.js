require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Khởi tạo Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Kết nối cơ sở dữ liệu MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*', // Cho phép mọi nguồn (localhost:8080, vercel.app, v.v.)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Hỗ trợ upload ảnh dạng Base64 dung lượng lớn (lên tới 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Endpoint kiểm tra sức khỏe hệ thống (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'MintyMart Backend API',
    database: 'MongoDB',
    timestamp: new Date().toISOString(),
  });
});

// Khai báo các Routes API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/zones', require('./routes/zoneRoutes'));
app.use('/api/items', require('./routes/itemRoutes'));
app.use('/api/menu', require('./routes/menuRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Đường dẫn API "${req.originalUrl}" không tồn tại.`,
  });
});

// Khởi chạy máy chủ (nếu chạy trực tiếp)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` 🍦 MintyMart Backend Server is running!`);
    console.log(` 🚀 URL: http://localhost:${PORT}`);
    console.log(` 📑 API Health: http://localhost:${PORT}/api/health`);
    console.log(` 📋 API Menu: http://localhost:${PORT}/api/menu`);
    console.log(`====================================================`);
  });
}

module.exports = app;
