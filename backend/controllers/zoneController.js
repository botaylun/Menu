const Zone = require('../models/Zone');
const Item = require('../models/Item');

// Lấy danh sách toàn bộ khu vực
exports.getZones = async (req, res) => {
  try {
    const zones = await Zone.find({ isDeleted: { $ne: true } }).sort({ order: 1, createdAt: 1 });
    return res.json({ success: true, count: zones.length, zones });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Thêm khu vực mới (Yêu cầu quyền Admin)
exports.createZone = async (req, res) => {
  try {
    const { k, flag, short, name, desc, order } = req.body;
    if (!k || !short || !name) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin mã khu, tên ngắn hoặc tên đầy đủ.' });
    }

    const cleanKey = k.trim().toLowerCase();
    const existing = await Zone.findOne({ k: cleanKey });
    if (existing) {
      if (existing.isDeleted) {
        existing.isDeleted = false;
        existing.flag = flag || existing.flag;
        existing.short = short;
        existing.name = name;
        existing.desc = desc || existing.desc;
        await existing.save();
        return res.json({ success: true, message: 'Đã khôi phục khu vực.', zone: existing });
      }
      return res.status(400).json({ success: false, message: 'Mã khu vực này đã tồn tại.' });
    }

    const newZone = await Zone.create({
      k: cleanKey,
      flag: flag || '🍦',
      short: short.trim(),
      name: name.trim(),
      desc: desc ? desc.trim() : 'Các món kem của khu này.',
      order: order || 0,
    });

    return res.status(201).json({ success: true, message: 'Thêm khu vực thành công!', zone: newZone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Cập nhật khu vực (Yêu cầu quyền Admin)
exports.updateZone = async (req, res) => {
  try {
    const { key } = req.params;
    const { flag, short, name, desc, order } = req.body;

    const zone = await Zone.findOne({ k: key });
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực.' });
    }

    if (flag !== undefined) zone.flag = flag.trim() || '🍦';
    if (short !== undefined) zone.short = short.trim();
    if (name !== undefined) zone.name = name.trim();
    if (desc !== undefined) zone.desc = desc.trim();
    if (order !== undefined) zone.order = Number(order);

    await zone.save();
    return res.json({ success: true, message: 'Cập nhật khu vực thành công!', zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa khu vực (Yêu cầu quyền Admin)
exports.deleteZone = async (req, res) => {
  try {
    const { key } = req.params;
    const zone = await Zone.findOne({ k: key });
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khu vực.' });
    }

    zone.isDeleted = true;
    await zone.save();

    // Ẩn các món trong khu vực này
    await Item.updateMany({ z: key }, { isDeleted: true });

    return res.json({ success: true, message: 'Đã xóa khu vực và các món liên quan.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
