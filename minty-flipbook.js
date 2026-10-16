/**
 * ============================================================================
 * MintyMart High-End 3D Page Flip Manager
 * Tích hợp StPageFlip (page-flip) cho Menu kem cao cấp
 * ============================================================================
 */

// 1. Module âm thanh lật trang (Đã tắt hoàn toàn theo yêu cầu người dùng)
class PaperAudioSynthesizer {
  constructor() {
    this.enabled = false;
  }
  init() {}
  play() {}
  toggle() { return false; }
}

// 2. Class Quản lý Cuốn sách Menu 3D
class MintyMenuFlipBook {
  // Tính số dòng tối đa mỗi trang (12 dòng chuẩn như ảnh mẫu, lấp đầy không gian)
  static _calcItemsPerPage(adminMode = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w;

    if (w < 480) return 7;
    if (w < 700) return 9;
    if (w < 1000) return isPortrait ? 9 : 11;
    return 12; // 12 dòng chuẩn như ảnh mẫu: lấp đầy toàn bộ trang, gộp các hãng chung trang
  }

  constructor(options = {}) {
    this.containerId = options.containerId || 'book';
    this.statusId = options.statusId || 'status';
    this.prevBtnId = options.prevBtnId || 'prev';
    this.nextBtnId = options.nextBtnId || 'next';
    this.segId = options.segId || 'seg';
    this.tabsId = options.tabsId || 'tabs';
    this.adminMode = false;
    this.itemsPerPage = options.itemsPerPage || MintyMenuFlipBook._calcItemsPerPage(false);

    this.pageFlip = null;
    this.audio = new PaperAudioSynthesizer();
    this.zones = [];
    this.items = [];
    this.pageData = []; // Danh sách metadata các trang
    this.zonePageMap = {}; // Map từ zoneKey -> pageIndex đầu tiên
    this.flashItem = null;
    this.onEditItem = options.onEditItem || null;
    this.onDeleteItem = options.onDeleteItem || null;
    this.onZoomImg = options.onZoomImg || null;

    this._bindGlobalEvents();
  }

  // Khởi tạo và nạp dữ liệu động (từ Backend API hoặc mảng JSON)
  init(zones, items, admin = false) {
    this.zones = zones || [];
    this.items = items || [];
    this.adminMode = admin;
    this.itemsPerPage = MintyMenuFlipBook._calcItemsPerPage(admin);

    this._buildPagesData();
    this._renderBookDOM();
    this._initStPageFlip();
    this._renderTabs();
    this._updateNavigation();
  }

  // Lấy chỉ số trang hiện tại của cuốn sách
  getCurrentPageIndex() {
    if (!this.pageFlip) return 0;
    try {
      const idx = this.pageFlip.getCurrentPageIndex();
      return typeof idx === 'number' && !isNaN(idx) ? idx : 0;
    } catch (e) {
      return 0;
    }
  }

  // Tìm trang chứa món cụ thể
  findPageOfItem(item) {
    if (!item || !this.pageData) return -1;
    const targetId = item._id || item.key;
    for (let i = 0; i < this.pageData.length; i++) {
      const p = this.pageData[i];
      if (p.rows && p.rows.some(r => (r._id && r._id === targetId) || (r.key && r.key === targetId) || (r.n === item.n && r.v === item.v))) {
        return i;
      }
    }
    return -1;
  }

  // Cập nhật lại dữ liệu khi Admin sửa/thêm/xóa món (giữ nguyên trang đang xem)
  update(zones, items, admin = false, coverData = null, targetPage = null) {
    let curPage = 0;
    if (targetPage !== null && targetPage !== undefined && typeof targetPage === 'number') {
      curPage = targetPage;
    } else if (this.pageFlip) {
      curPage = this.getCurrentPageIndex();
    }

    this.zones = zones || [];
    this.items = items || [];
    this.adminMode = admin;
    this.itemsPerPage = MintyMenuFlipBook._calcItemsPerPage(admin);
    if (coverData) this.coverData = coverData;

    if (this.pageFlip) {
      try { this.pageFlip.destroy(); } catch (e) { }
      this.pageFlip = null;
    }

    this._buildPagesData();
    this._renderBookDOM();

    // Giới hạn trang an toàn
    const safePage = Math.max(0, Math.min(curPage, this.pageData.length - 1));
    this._initStPageFlip(safePage);
    this._renderTabs();
    this._updateNavigation();
  }

  // Chia mảng món kem thành các trang theo từng khu vực và hãng
  _buildPagesData() {
    this.pageData = [];
    this.zonePageMap = {};
    const OTH = 'Hãng khác';

    // Trang 0: Bìa trước (Front Cover)
    this.pageData.push({ type: 'front-cover' });

    // Trang 1: Lời giới thiệu & Mục lục (Intro & Table of Contents)
    this.pageData.push({ type: 'toc' });

    // Các trang ruột thực đơn kem
    this.zones.forEach((z, zi) => {
      const zoneItems = this.items.filter(x => x.z === z.k);
      if (!zoneItems.length) return;

      // Gom nhóm theo hãng
      const brandCount = {};
      zoneItems.forEach(x => { brandCount[x.b] = (brandCount[x.b] || 0) + 1; });
      const brands = Object.keys(brandCount).sort((a, b) => (a === OTH) - (b === OTH) || brandCount[b] - brandCount[a]);

      const rows = [];
      brands.forEach(b => {
        rows.push({ h: b }); // Tiêu đề hãng
        zoneItems.filter(x => x.b === b).sort((p, q) => p.v - q.v).forEach(x => rows.push(x));
      });

      // Chia thành các trang theo giới hạn itemsPerPage
      const zonePages = [];
      let currentRows = [];
      let currentBrand = null;

      const flush = () => {
        if (currentRows.length) {
          zonePages.push(currentRows);
          currentRows = [];
        }
      };

      rows.forEach(r => {
        if (r.h !== undefined) {
          if (currentRows.length >= this.itemsPerPage - 1) flush();
          currentBrand = r.h;
          currentRows.push(r);
          return;
        }
        if (currentRows.length >= this.itemsPerPage) {
          flush();
          currentRows.push({ h: currentBrand, cont: true });
        }
        currentRows.push(r);
      });
      flush();

      // Lưu lại chỉ số trang đầu tiên của khu vực này
      const startPageIndex = this.pageData.length;
      this.zonePageMap[z.k] = startPageIndex;

      zonePages.forEach((rs, k) => {
        this.pageData.push({
          type: 'menu',
          zi,
          z,
          part: k,
          parts: zonePages.length,
          total: zoneItems.length,
          rows: rs
        });
      });
    });

    // Trang cuối cùng: Bìa sau (Back Cover)
    this.pageData.push({ type: 'back-cover' });
  }

  // Sinh HTML các trang sách vào container DOM
  _renderBookDOM() {
    let bookEl = document.getElementById(this.containerId);
    if (!bookEl) {
      const wrapper = document.querySelector('.book-wrapper') || document.body;
      bookEl = document.createElement('div');
      bookEl.id = this.containerId;
      bookEl.className = 'st-page-flip';
      wrapper.appendChild(bookEl);
    }
    bookEl.replaceChildren();

    this.pageData.forEach((p, idx) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'page';

      if (p.type === 'front-cover') {
        pageEl.classList.add('page-cover', 'page-cover-front');
        pageEl.setAttribute('data-density', 'hard');
        pageEl.innerHTML = this._createFrontCoverHTML();
      } else if (p.type === 'back-cover') {
        pageEl.classList.add('page-cover', 'page-cover-back');
        pageEl.setAttribute('data-density', 'hard');
        pageEl.innerHTML = this._createBackCoverHTML();
      } else if (p.type === 'toc') {
        pageEl.classList.add('page-inner');
        pageEl.setAttribute('data-density', 'soft');
        pageEl.innerHTML = this._createTocHTML();
      } else {
        pageEl.classList.add('page-inner');
        pageEl.setAttribute('data-density', 'soft');
        pageEl.append(this._createMenuPageElement(p, idx));
      }

      bookEl.append(pageEl);
    });

    // Bắt sự kiện click vào các mục trong trang Mục Lục (TOC)
    bookEl.querySelectorAll('[data-goto-zone]').forEach(btn => {
      btn.onclick = () => {
        const zk = btn.getAttribute('data-goto-zone');
        if (this.zonePageMap[zk] !== undefined) {
          this.turnToPage(this.zonePageMap[zk]);
        }
      };
    });
  }

  // Khởi tạo thư viện StPageFlip
  _initStPageFlip(startPage = 0) {
    const bookEl = document.getElementById(this.containerId);
    if (!bookEl || !window.St || !window.St.PageFlip) {
      console.warn('St.PageFlip library is not loaded!');
      return;
    }

    const safeStartPage = Math.max(0, Math.min(startPage, this.pageData.length - 1));

    this.pageFlip = new window.St.PageFlip(bookEl, {
      width: 480,                 // Chiều rộng cơ bản của 1 trang
      height: 720,                // Chiều cao cơ bản của 1 trang (tỉ lệ 1:1.5)
      size: 'stretch',            // Co giãn linh hoạt theo kích thước khung bao
      minWidth: 320,              // Chiều rộng nhỏ nhất trên mobile
      maxWidth: 580,              // Chiều rộng lớn nhất trên desktop
      minHeight: 520,
      maxHeight: 880,
      maxShadowOpacity: 0.35,     // Độ sâu của bóng uốn lượn 3D
      showCover: true,            // Nhận diện Bìa trước và Bìa sau là bìa cứng (Hard Cover)
      mobileScrollSupport: true,  // Cho phép cuộn trang mượt mà trên mobile
      swipeDistance: 25,          // Khoảng cách vuốt tay (px) đủ để kích hoạt lật
      flippingTime: 750,          // Thời gian hoàn tất lật trang (0.75 giây mượt mà)
      usePortrait: true,          // Tự động chuyển 1 trang (Portrait) trên Mobile, 2 trang (Landscape) trên Desktop
      startPage: safeStartPage,
      autoSize: true,
      useMouseEvents: true,       // Bật kéo góc trang bằng chuột trên PC
      showPageCorners: false,     // Tắt hé góc
      disableFlipByClick: true,   // CHỈ cho vuốt hoặc bấm nút Trang trước/sau, KHÔNG lật khi nhấn vào trang
      clickEventForward: true     // Cho phép bấm nút phóng to ảnh hoặc admin bên trong trang
    });

    // Nạp các trang DOM vào engine PageFlip
    const pageElements = bookEl.querySelectorAll('.page');
    this.pageFlip.loadFromHTML(pageElements);

    if (safeStartPage > 0) {
      try {
        this.pageFlip.turnToPage(safeStartPage);
      } catch (e) { }
    }

    // Bắt các sự kiện lật trang
    this.pageFlip.on('flip', (e) => {
      this._updateNavigation();
      this._updateActiveTab();
    });

    this.pageFlip.on('changeOrientation', () => {
      this._updateNavigation();
    });

    this.pageFlip.on('init', () => {
      if (safeStartPage > 0) {
        try {
          this.pageFlip.turnToPage(safeStartPage);
        } catch (e) { }
      }
      this._updateNavigation();
      this._updateActiveTab();
    });
  }

  // HTML Bìa Trước (Front Cover)
  _createFrontCoverHTML() {
    const c = Object.assign({
      frontBadge: '★ MINTYMART COLLECTION ★',
      frontTitle: 'THỰC ĐƠN KEM',
      frontSub: 'Tuyển tập những hương vị kem mát lạnh trứ danh từ khắp nơi trên thế giới',
      frontFooter: 'MINTYMART · PREMIUM GELATO',
      backTitle: 'CẢM ƠN QUÝ KHÁCH',
      backSub: 'Chúc bạn có những phút giây ngọt ngào và sảng khoái cùng kem ngon tại MintyMart.',
    }, this.coverData || {});

    return `
      <div class="page-content cover-content">
        <div class="cover-border">
          <div>
            <div class="cover-badge">${c.frontBadge}</div>
            <div class="cover-logo-container">
              <img src="mintymart-logo.png" alt="MintyMart Logo" class="cover-main-logo">
            </div>
            <h1 class="cover-title">${c.frontTitle}</h1>
            <p class="cover-sub">${c.frontSub}</p>
          </div>
          <div class="cover-footer">
            <span>${c.frontFooter}</span>
            <span class="hint">📖 Vuốt hoặc bấm Trang sau để mở ➔</span>
          </div>
        </div>
      </div>
    `;
  }

  // HTML Trang Mục Lục (TOC)
  _createTocHTML() {
    let itemsHTML = '';
    this.zones.forEach(z => {
      const pageIdx = this.zonePageMap[z.k];
      const count = this.items.filter(x => x.z === z.k).length;
      if (!count || pageIdx === undefined) return;
      itemsHTML += `
        <li class="toc-item" data-goto-zone="${z.k}">
          <div>
            <span class="flag">${z.flag}</span>
            <b>${z.name}</b>
            <small style="display:block;color:var(--mut);font-size:11px;margin-top:2px">${count} món tuyển chọn</small>
          </div>
          <span class="page-num">Trang ${String(pageIdx + 1).padStart(2, '0')} ➔</span>
        </li>
      `;
    });

    return `
      <div class="page-content">
        <div class="eyebrow">GIỚI THIỆU & MỤC LỤC</div>
        <h2 class="toc-title">Hành Trình Vị Giác</h2>
        <p class="toc-desc">Chào mừng bạn đến với thiên đường kem MintyMart. Hãy chọn một khu vực bên dưới để mở ngay hương vị bạn yêu thích:</p>
        <ul class="toc-list">${itemsHTML}</ul>
        <div class="foot" style="margin-top:auto">
          <span>MINTYMART</span>
          <b>01</b>
        </div>
      </div>
    `;
  }

  // HTML Bìa Sau (Back Cover)
  _createBackCoverHTML() {
    const c = Object.assign({
      backTitle: 'CẢM ƠN QUÝ KHÁCH',
      backSub: 'Chúc bạn có những phút giây ngọt ngào và sảng khoái cùng kem ngon tại MintyMart.',
    }, this.coverData || {});

    const contactRows = (Array.isArray(c.contactRows) && c.contactRows.length)
      ? c.contactRows
      : [
          { icon: '📍', label: 'Địa chỉ', value: c.address || 'Hệ thống MintyMart Toàn Quốc' },
          { icon: '📞', label: 'Hotline / Zalo', value: c.hotline || '0909 888 999' },
          { icon: '⏰', label: 'Giờ phục vụ', value: c.hours || '08:00 – 22:30 mỗi ngày' },
          { icon: '🛵', label: 'Giao hàng', value: c.delivery || 'GrabFood · ShopeeFood · BeFood' }
        ];

    const rowsHTML = contactRows.map(r => `
      <div>${r.icon ? `<span>${r.icon}</span>` : ''}<b>${r.label}:</b> <span>${r.value}</span></div>
    `).join('');

    return `
      <div class="page-content cover-content">
        <div class="cover-border">
          <div class="back-cover-box">
            <div style="font-size:36px;margin-bottom:8px">🍧</div>
            <h3>${c.backTitle}</h3>
            <p>${c.backSub}</p>
            <div class="contact-card">
              ${rowsHTML}
            </div>
          </div>
          <div class="cover-footer">
            <span>HẸN GẶP LẠI QUÝ KHÁCH</span>
            <span class="hint">← Kéo trang sang phải để đọc lại</span>
          </div>
        </div>
      </div>
    `;
  }

  // Sinh phần tử DOM cho một trang ruột thực đơn
  _createMenuPageElement(p, idx) {
    const s = document.createElement('div');
    s.className = 'page-content';

    const lab = document.createElement('div');
    lab.className = 'eyebrow';
    lab.textContent = `${String(p.zi + 1).padStart(2, '0')} / ${p.z.name.toUpperCase()} ${p.parts > 1 ? ` · ${p.part + 1}/${p.parts}` : ''}`;

    const h = document.createElement('h2');
    h.style.cssText = 'font-size:clamp(22px, 3.2vw, 28px);margin:6px 0 4px;font-family:Noto Serif, serif;';
    h.textContent = `${p.z.flag} ${p.z.name}`;

    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.style.cssText = 'margin:0 0 14px;font-size:13px;';
    sub.textContent = `${p.z.desc} (${p.total} món)`;

    const ul = document.createElement('ul');
    ul.className = 'list';

    p.rows.forEach(it => {
      if (it.h !== undefined) {
        const hl = document.createElement('li');
        hl.className = 'bh';
        hl.textContent = (it.h === 'Hãng khác' ? 'Các hãng khác' : `Hãng ${it.h}`) + (it.cont ? ' (tiếp)' : '');
        ul.append(hl);
        return;
      }

      const li = document.createElement('li');
      let im;
      if (it.img) {
        im = document.createElement('img');
        im.src = it.img;
        im.alt = it.n;
        im.width = 44;
        im.height = 44;
        im.loading = 'lazy';
        im.setAttribute('role', 'button');
        im.tabIndex = 0;
        im.title = 'Bấm để phóng to ảnh';
        im.onclick = (e) => {
          e.stopPropagation();
          if (this.onZoomImg) this.onZoomImg(it);
        };
      } else {
        im = document.createElement('div');
        im.className = 'ph';
      }

      const n = document.createElement('div');
      n.className = 'nm';
      n.textContent = it.n;

      const pr = document.createElement('div');
      pr.className = 'pr';
      pr.textContent = it.v.toLocaleString('vi-VN').replace(/,/g, '.') + 'đ';

      li.append(im, n, pr);

      if (it === this.flashItem) {
        li.classList.add('hl');
      }

      if (this.adminMode) {
        const eBtn = document.createElement('button');
        eBtn.className = 'del ed';
        eBtn.textContent = '✎';
        eBtn.title = 'Sửa món này';
        eBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.onEditItem) this.onEditItem(it);
        };

        const dBtn = document.createElement('button');
        dBtn.className = 'del';
        dBtn.textContent = '×';
        dBtn.title = 'Xóa món này';
        dBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.onDeleteItem) this.onDeleteItem(it);
        };

        li.append(eBtn, dBtn);
      }

      ul.append(li);
    });

    const f = document.createElement('div');
    f.className = 'foot';
    f.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-top:auto;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);padding-top:10px;border-top:1px solid var(--line);';
    f.innerHTML = `<span>${p.z.short}</span><b style="font:400 18px 'Noto Serif',serif;color:var(--gold);letter-spacing:0">${String(idx + 1).padStart(2, '0')}</b>`;

    s.append(lab, h, sub, ul, f);
    return s;
  }

  // Chuyển trực tiếp đến trang chỉ định
  turnToPage(pageIndex) {
    if (!this.pageFlip) return;
    const target = Math.max(0, Math.min(pageIndex, this.pageData.length - 1));
    try {
      this.pageFlip.flip(target, 'top');
    } catch (e) {
      this.pageFlip.turnToPage(target);
    }
  }

  // Lật trang trước
  flipPrev() {
    if (!this.pageFlip) return;
    try {
      this.pageFlip.flipPrev('top');
    } catch (e) {
      this.pageFlip.turnToPrevPage();
    }
  }

  // Lật trang sau
  flipNext() {
    if (!this.pageFlip) return;
    try {
      this.pageFlip.flipNext('top');
    } catch (e) {
      this.pageFlip.turnToNextPage();
    }
  }

  // Cập nhật trạng thái hiển thị thanh tiến trình và số trang
  _updateNavigation() {
    if (!this.pageFlip) return;

    const cur = this.pageFlip.getCurrentPageIndex();
    const total = this.pageFlip.getPageCount();
    const isPortrait = this.pageFlip.getOrientation() === 'portrait';

    const pageCol = this.pageFlip.getPageCollection();
    const spreads = (pageCol && pageCol.getSpread) ? pageCol.getSpread() : [];
    const curSpreadIdx = (pageCol && pageCol.getCurrentSpreadIndex) ? pageCol.getCurrentSpreadIndex() : 0;

    // Cập nhật vị trí căn giữa cho bìa sách (tránh mảng trắng trống)
    const wrapper = document.querySelector('.book-wrapper');
    if (wrapper) {
      if (cur === 0) {
        wrapper.className = 'book-wrapper cover-front';
      } else if (cur >= total - 1) {
        wrapper.className = 'book-wrapper cover-back';
      } else {
        wrapper.className = 'book-wrapper open-spread';
      }
    }

    // Cập nhật text trạng thái
    const statusEl = document.getElementById(this.statusId);
    if (statusEl) {
      if (cur === 0) {
        statusEl.textContent = 'Bìa trước · Khởi đầu';
      } else if (cur >= total - 1) {
        statusEl.textContent = 'Bìa sau · Kết thúc';
      } else if (isPortrait) {
        statusEl.textContent = `Trang ${String(cur + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      } else {
        const spreadPages = spreads[curSpreadIdx] || [cur, Math.min(cur + 1, total - 1)];
        const p1 = spreadPages[0] + 1;
        const p2 = (spreadPages[1] !== undefined) ? spreadPages[1] + 1 : p1;
        if (p1 === p2) {
          statusEl.textContent = `Trang ${String(p1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
        } else {
          statusEl.textContent = `Trang ${String(p1).padStart(2, '0')} — ${String(p2).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
        }
      }
    }

    // Cập nhật nút Trước / Sau
    const prevBtn = document.getElementById(this.prevBtnId);
    const nextBtn = document.getElementById(this.nextBtnId);
    if (prevBtn) {
      prevBtn.disabled = cur <= 0;
      prevBtn.onclick = (e) => {
        e.preventDefault();
        this.flipPrev();
      };
    }
    if (nextBtn) {
      nextBtn.disabled = cur >= total - 1;
      nextBtn.onclick = (e) => {
        e.preventDefault();
        this.flipNext();
      };
    }

    // Cập nhật vạch phân đoạn (Segments) khớp chính xác 100% từng Spread
    const segEl = document.getElementById(this.segId);
    if (segEl) {
      segEl.replaceChildren();
      if (spreads.length > 0) {
        spreads.forEach((spreadPages, sIdx) => {
          const segItem = document.createElement('i');
          if (sIdx === curSpreadIdx) segItem.className = 'on';
          const startPg = spreadPages[0] + 1;
          segItem.title = `Chuyển tới trang ${startPg}`;
          segItem.onclick = (e) => {
            e.preventDefault();
            this.turnToPage(spreadPages[0]);
          };
          segEl.append(segItem);
        });
      } else {
        const step = isPortrait ? 1 : 2;
        for (let i = 0; i < total; i += step) {
          const segItem = document.createElement('i');
          if (cur >= i && cur < i + step) segItem.className = 'on';
          segItem.title = `Chuyển tới trang ${i + 1}`;
          segItem.onclick = (e) => {
            e.preventDefault();
            this.turnToPage(i);
          };
          segEl.append(segItem);
        }
      }
    }

    this._updateActiveTab();
  }

  // Tạo các Tab nhóm kem
  _renderTabs() {
    const tabsEl = document.getElementById(this.tabsId);
    if (!tabsEl) return;
    tabsEl.replaceChildren();

    this.zones.forEach(z => {
      const pageIdx = this.zonePageMap[z.k];
      if (pageIdx === undefined) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.setAttribute('data-zone-key', z.k);
      btn.textContent = `${z.flag} ${z.short}`;
      btn.onclick = (e) => {
        e.preventDefault();
        this.lastTargetZone = z.k;
        this.turnToPage(pageIdx);
      };
      tabsEl.append(btn);
    });
  }

  // Đánh dấu Tab đang hoạt động tương ứng với trang đang mở
  _updateActiveTab() {
    if (!this.pageFlip) return;

    const pageCol = this.pageFlip.getPageCollection();
    const spreads = (pageCol && pageCol.getSpread) ? pageCol.getSpread() : [];
    const curSpreadIdx = (pageCol && pageCol.getCurrentSpreadIndex) ? pageCol.getCurrentSpreadIndex() : 0;
    const currentPages = spreads[curSpreadIdx] || [this.pageFlip.getCurrentPageIndex()];

    let activeZoneKey = null;

    // 1. Kiểm tra xem zone người dùng vừa bấm có nằm trên spread hiện tại không
    if (this.lastTargetZone) {
      for (const pIdx of currentPages) {
        const p = this.pageData[pIdx];
        if (p && p.z && p.z.k === this.lastTargetZone) {
          activeZoneKey = this.lastTargetZone;
          break;
        }
      }
    }

    // 2. Nếu không, lấy zone của trang ruột đầu tiên trên spread hiện tại
    if (!activeZoneKey) {
      for (const pIdx of currentPages) {
        const p = this.pageData[pIdx];
        if (p && p.z && p.z.k) {
          activeZoneKey = p.z.k;
          break;
        }
      }
    }

    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(t => {
      const zKey = t.getAttribute('data-zone-key');
      const isCurrent = activeZoneKey && (zKey === activeZoneKey);
      t.setAttribute('aria-current', isCurrent ? 'true' : 'false');
      if (isCurrent) {
        t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    });
  }

  // Nhảy đến món kem khi tìm kiếm và làm sáng nhấp nháy
  highlightItem(item) {
    if (!item) return;
    let targetIndex = -1;

    for (let i = 0; i < this.pageData.length; i++) {
      const p = this.pageData[i];
      if (p.rows && p.rows.includes(item)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex >= 0) {
      this.flashItem = item;
      this.turnToPage(targetIndex);

      setTimeout(() => {
        const hl = document.querySelector('.hl');
        if (hl) hl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 850);

      setTimeout(() => {
        this.flashItem = null;
        document.querySelectorAll('.hl').forEach(el => el.classList.remove('hl'));
      }, 4200);
    }
  }

  // Gắn các phím tắt bàn phím và xử lý xoay màn hình
  _bindGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]')) return; // Không can thiệp khi đang mở modal
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        this.flipNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.flipPrev();
      }
    });

    const prevBtn = document.getElementById(this.prevBtnId);
    const nextBtn = document.getElementById(this.nextBtnId);
    if (prevBtn) prevBtn.onclick = () => this.flipPrev();
    if (nextBtn) nextBtn.onclick = () => this.flipNext();

    // Tự tính lại itemsPerPage khi xoay màn hình điện thoại
    let resizeTimer = null;
    const onOrientationChange = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const newCount = MintyMenuFlipBook._calcItemsPerPage();
        if (newCount !== this.itemsPerPage) {
          this.itemsPerPage = newCount;
          const curPage = this.pageFlip ? this.pageFlip.getCurrentPageIndex() : 0;
          if (this.pageFlip) {
            try { this.pageFlip.destroy(); } catch (e) { }
            this.pageFlip = null;
          }
          this._buildPagesData();
          this._renderBookDOM();
          this._initStPageFlip(curPage);
          this._renderTabs();
          this._updateNavigation();
        }
      }, 300);
    };

    window.addEventListener('orientationchange', onOrientationChange);
    window.addEventListener('resize', onOrientationChange);
  }

}

// Xuất ra phạm vi toàn cục (Global Scope) cho Vanilla JS
window.MintyMenuFlipBook = MintyMenuFlipBook;
window.PaperAudioSynthesizer = PaperAudioSynthesizer;
