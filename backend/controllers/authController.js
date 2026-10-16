const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Đăng nhập Admin
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      });
    }

    const cleanUser = username.trim().toLowerCase();
    let admin = await Admin.findOne({ username: cleanUser });

    // Nếu database chưa có tài khoản nào, tự động tạo tài khoản mặc định
    if (!admin && cleanUser === (process.env.DEFAULT_ADMIN_USER || 'mintymart').toLowerCase()) {
      const defaultPass = process.env.DEFAULT_ADMIN_PASS || '123456';
      if (password === defaultPass) {
        admin = await Admin.create({
          username: cleanUser,
          password: defaultPass,
          name: 'Quản trị viên MintyMart',
        });
      }
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Sai tên đăng nhập hoặc mật khẩu.',
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Sai tên đăng nhập hoặc mật khẩu.',
      });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'mintymart_super_secret_jwt_key_2026',
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi đăng nhập: ' + error.message,
    });
  }
};

// Lấy thông tin tài khoản đang đăng nhập
exports.getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }
    return res.json({ success: true, admin });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu cũ và mới.' });
    }
    const admin = await Admin.findById(req.admin.id);
    const isMatch = await admin.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác.' });
    }
    admin.password = newPassword;
    await admin.save();
    return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
