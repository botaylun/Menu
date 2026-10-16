const Zone = require('../models/Zone');
const Item = require('../models/Item');
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

// Lấy toàn bộ dữ liệu Menu (Khu vực + Món kem + Trang bìa) cho trang chủ
exports.getMenuData = async (req, res) => {
  try {
    const [zones, items, coverSetting] = await Promise.all([
      Zone.find({ isDeleted: { $ne: true } }).sort({ order: 1, createdAt: 1 }).lean(),
      Item.find({ isDeleted: { $ne: true } }).sort({ z: 1, b: 1, v: 1 }).lean(),
      Setting.findOne({ key: 'cover_settings' }).lean(),
    ]);

    res.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=59');
    return res.json({
      success: true,
      data: {
        cover: coverSetting ? { ...defaultCover, ...coverSetting.value } : defaultCover,
        zones: zones.map(z => ({
          _id: z._id,
          k: z.k,
          flag: z.flag,
          short: z.short,
          name: z.name,
          desc: z.desc,
        })),
        items: items.map(it => ({
          _id: it._id,
          z: it.z,
          b: it.b,
          n: it.n,
          v: it.v,
          img: it.img,
          bg: it.bg,
          isAvailable: it.isAvailable,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
