const Setting = require('../models/Setting');

const defaultCover = {
  brandName: 'MintyMart',
  frontBadge: '★ MINTYMART COLLECTION ★',
  frontTitle: 'THỰC ĐƠN KEM',
  frontSub: 'Tuyển tập những hương vị kem mát lạnh trứ danh từ khắp nơi trên thế giới',
  frontFooter: 'MINTYMART · PREMIUM GELATO',
  backTitle: 'CẢM ƠN QUÝ KHÁCH',
  backSub: 'Chúc bạn có những phút giây ngọt ngào và sảng khoái cùng kem ngon tại MintyMart.',
  address: 'Chi nhánh MintyMart toàn quốc',
  hotline: '090x xxx xxx',
  hours: '08:00 – 22:30 mỗi ngày',
  delivery: 'GrabFood · ShopeeFood · BeFood',
};

// Lấy cài đặt trang bìa
exports.getCoverSettings = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'cover_settings' });
    return res.json({
      success: true,
      cover: setting ? { ...defaultCover, ...setting.value } : defaultCover,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Lưu cài đặt trang bìa (Admin only)
exports.updateCoverSettings = async (req, res) => {
  try {
    const newSettings = req.body;
    const setting = await Setting.findOneAndUpdate(
      { key: 'cover_settings' },
      {
        $set: {
          value: { ...defaultCover, ...newSettings },
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: 'Cập nhật trang bìa thành công!',
      cover: setting.value,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
