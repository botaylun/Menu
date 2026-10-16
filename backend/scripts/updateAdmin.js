require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

async function updateAdminPassword() {
  await connectDB();
  try {
    let admin = await Admin.findOne({ username: 'mintymart' });
    if (!admin) {
      console.log('Tài khoản mintymart chưa có, đang tạo mới...');
      admin = new Admin({
        username: 'mintymart',
        password: 'minty@469',
        name: 'Quản trị viên MintyMart',
        role: 'admin'
      });
    } else {
      admin.password = 'minty@469';
    }
    await admin.save();
    console.log('>>> THÀNH CÔNG: Đã đổi mật khẩu tài khoản [mintymart] thành [minty@469]');
  } catch (err) {
    console.error('Lỗi cập nhật mật khẩu:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

updateAdminPassword();
