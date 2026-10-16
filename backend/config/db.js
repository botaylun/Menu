const mongoose = require('mongoose');

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mintymart';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Kết nối thành công tới Database: ${conn.connection.name} (${conn.connection.host})`);
    return true;
  } catch (error) {
    console.error(`[MongoDB] Lỗi kết nối: ${error.message}`);
    console.warn(`[MongoDB] Lưu ý: Vui lòng đảm bảo MongoDB đang chạy tại ${uri} hoặc cập nhật MONGODB_URI`);
    return false;
  }
};

module.exports = connectDB;
