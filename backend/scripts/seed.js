require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Zone = require('../models/Zone');
const Item = require('../models/Item');
const Admin = require('../models/Admin');

const seedData = async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('Không thể kết nối MongoDB để nạp dữ liệu. Hãy kiểm tra lại service MongoDB!');
    process.exit(1);
  }

  try {
    console.log('Đang đọc dữ liệu kem từ file index.html...');
    let htmlPath = path.join(__dirname, '../../mintymart/index.html');
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(__dirname, '../../index.html');
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const match = htmlContent.match(/const DATA\s*=\s*(\{[\s\S]*?\});/);

    if (!match) {
      throw new Error('Không tìm thấy biến DATA trong index.html');
    }

    const rawData = JSON.parse(match[1]);
    console.log(`Tìm thấy: ${rawData.zones.length} khu vực và ${rawData.items.length} món kem.`);

    // 1. Nạp khu vực
    console.log('Đang đồng bộ danh mục khu vực vào MongoDB...');
    await Zone.deleteMany({});
    for (let i = 0; i < rawData.zones.length; i++) {
      const z = rawData.zones[i];
      await Zone.create({
        k: z.k,
        flag: z.flag || '🍦',
        short: z.short,
        name: z.name,
        desc: z.desc || '',
        order: i,
      });
    }
    console.log(`✓ Đã nạp thành công ${rawData.zones.length} khu vực vào MongoDB.`);

    // 2. Nạp món kem
    console.log('Đang nạp toàn bộ món kem vào MongoDB...');
    await Item.deleteMany({});
    const itemsToInsert = rawData.items.map((it, idx) => ({
      z: it.z,
      b: it.b || 'Hãng khác',
      n: it.n,
      v: it.v,
      img: it.img || '',
      bg: it.bg || '',
      order: idx,
      isAvailable: true,
      isDeleted: false,
    }));

    await Item.insertMany(itemsToInsert);
    console.log(`✓ Đã nạp thành công ${itemsToInsert.length} món kem vào MongoDB.`);

    // 3. Khởi tạo tài khoản Admin mặc định
    console.log('Đang khởi tạo tài khoản quản trị Admin...');
    await Admin.deleteMany({});
    const adminUser = process.env.DEFAULT_ADMIN_USER || 'mintymart';
    const adminPass = process.env.DEFAULT_ADMIN_PASS || '123456';

    await Admin.create({
      username: adminUser,
      password: adminPass,
      name: 'Quản trị viên MintyMart',
      role: 'admin',
    });
    console.log(`✓ Đã tạo tài khoản Admin mặc định: [ Username: "${adminUser}" | Password: "${adminPass}" ]`);

    console.log('\n======================================================');
    console.log('🎉 TOÀN BỘ DỮ LIỆU ĐÃ ĐƯỢC ĐỒNG BỘ VÀO MONGODB THÀNH CÔNG!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('Lỗi trong quá trình nạp dữ liệu:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('Đã đóng kết nối cơ sở dữ liệu.');
    process.exit(0);
  }
};

seedData();
