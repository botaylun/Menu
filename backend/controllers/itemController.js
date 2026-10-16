const Item = require('../models/Item');
const Zone = require('../models/Zone');

// Lấy danh sách món kem (Hỗ trợ lọc theo zone, hãng, tìm kiếm)
exports.getItems = async (req, res) => {
  try {
    const { zone, brand, q, available } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (zone) filter.z = zone;
    if (brand) filter.b = brand;
    if (available !== undefined) filter.isAvailable = available === 'true';

    if (q) {
      const keyword = q.trim();
      filter.$or = [
        { n: { $regex: keyword, $options: 'i' } },
        { b: { $regex: keyword, $options: 'i' } },
      ];
    }

    const items = await Item.find(filter).sort({ z: 1, b: 1, v: 1 });
    return res.json({ success: true, count: items.length, items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Lấy chi tiết một món
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món kem.' });
    }
    return res.json({ success: true, item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Thêm món kem mới (Yêu cầu quyền Admin)
exports.createItem = async (req, res) => {
  try {
    const { z, b, n, v, img, bg, isAvailable } = req.body;
    if (!z || !n || v === undefined) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp khu vực (z), tên món (n) và giá tiền (v).' });
    }

    const numPrice = Math.round(Number(v));
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Giá tiền không hợp lệ.' });
    }

    // Đảm bảo khu vực tồn tại
    const zoneExists = await Zone.findOne({ k: z, isDeleted: { $ne: true } });
    if (!zoneExists) {
      return res.status(400).json({ success: false, message: `Khu vực "${z}" không tồn tại hoặc đã bị xóa.` });
    }

    const newItem = await Item.create({
      z: z.trim(),
      b: (b && b.trim()) || 'Hãng khác',
      n: n.trim(),
      v: numPrice,
      img: img || '',
      bg: bg || '',
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
    });

    return res.status(201).json({ success: true, message: 'Thêm món kem thành công!', item: newItem });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Sửa món kem (Yêu cầu quyền Admin)
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { z, b, n, v, img, bg, isAvailable, order } = req.body;

    const item = await Item.findById(id);
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món kem.' });
    }

    if (z !== undefined) item.z = z.trim();
    if (b !== undefined) item.b = b.trim() || 'Hãng khác';
    if (n !== undefined) item.n = n.trim();
    if (v !== undefined) {
      const numPrice = Math.round(Number(v));
      if (!isNaN(numPrice) && numPrice >= 0) item.v = numPrice;
    }
    if (img !== undefined) item.img = img;
    if (bg !== undefined) item.bg = bg;
    if (isAvailable !== undefined) item.isAvailable = Boolean(isAvailable);
    if (order !== undefined) item.order = Number(order);

    await item.save();
    return res.json({ success: true, message: 'Cập nhật món thành công!', item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Xóa món kem (Yêu cầu quyền Admin)
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item || item.isDeleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy món kem.' });
    }

    item.isDeleted = true;
    await item.save();

    return res.json({ success: true, message: `Đã xóa món "${item.n}".` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
