/**
 * ============================================================================
 * MintyMart High-End 3D Page Flip Manager
 * Tích hợp StPageFlip (page-flip) cho Menu kem cao cấp
 * ============================================================================
 */

// 1. Module âm thanh lật trang chân thực (Web Audio API Synthesizer)
class PaperAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('minty_sound_enabled') !== '0'; // Mặc định bật
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => { });
    }
  }

  play() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;

      // Tạo xung nhiễu hồng (Pink Noise) mô phỏng sợi giấy ma sát
      const bufferSize = Math.floor(ctx.sampleRate * 0.16); // 160ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        data[i] = (b0 + b1 + b2) * 1.6;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bộ lọc dải thông (Bandpass) quét tần số từ cao xuống thấp khi vạt giấy lướt qua
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1450, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.14);
      filter.Q.value = 1.4;

      // Bộ lọc cắt bớt dải trầm để âm thanh thanh thoát
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(320, now);

      // Đường bao âm lượng (Envelope ADSR)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(hp);
      hp.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.16);
    } catch (e) {
      // Trình duyệt chưa cho phép phát âm thanh tự động (chờ user click)
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('minty_sound_enabled', this.enabled ? '1' : '0');
    if (this.enabled) this.play();
    return this.enabled;
  }
}

// 2. Class Quản lý Cuốn sách Menu 3D
class MintyMenuFlipBook {
  constructor(options = {}) {
    this.containerId = options.containerId || 'book';
    this.statusId = options.statusId || 'status';
    this.prevBtnId = options.prevBtnId || 'prev';
    this.nextBtnId = options.nextBtnId || 'next';
    this.segId = options.segId || 'seg';
    this.tabsId = options.tabsId || 'tabs';
    this.itemsPerPage = options.itemsPerPage || 14;

    this.pageFlip = null;
    this.audio = new PaperAudioSynthesizer();
    this.zones = [];
    this.items = [];
    this.pageData = []; // Danh sách metadata các trang
    this.zonePageMap = {}; // Map từ zoneKey -> pageIndex đầu tiên
    this.adminMode = false;
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

    this._buildPagesData();
    this._renderBookDOM();
    this._initStPageFlip();
    this._renderTabs();
    this._updateNavigation();
  }

  // Cập nhật lại dữ liệu khi Admin sửa/thêm/xóa món
  update(zones, items, admin = false) {
    const curPage = this.pageFlip ? this.pageFlip.getCurrentPageIndex() : 0;
    this.zones = zones || [];
    this.items = items || [];
    this.adminMode = admin;

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
          if (currentRows.length >= this.itemsPerPage - 2) flush();
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

    // Đảm bảo số trang ruột là số chẵn để Bìa Sau luôn nằm đúng vị trí đóng sách ở chế độ Double Page Spread
    // Trang 0: Bìa trước
    // Các trang ruột: từ 1 đến N
    // Bìa sau: N + 1
    if ((this.pageData.length - 1) % 2 !== 0) {
      this.pageData.push({ type: 'notes' }); // Trang ghi chú & câu chuyện thương hiệu
    }

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
      } else if (p.type === 'notes') {
        pageEl.classList.add('page-inner');
        pageEl.setAttribute('data-density', 'soft');
        pageEl.innerHTML = this._createNotesHTML();
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
      maxShadowOpacity: 0.75,     // Độ sâu của bóng uốn lượn 3D
      showCover: true,            // Nhận diện Bìa trước và Bìa sau là bìa cứng (Hard Cover)
      mobileScrollSupport: false, // Tắt scroll mặc định để thao tác vuốt ưu tiên lật trang
      swipeDistance: 25,          // Khoảng cách vuốt tay (px) đủ để kích hoạt lật
      flippingTime: 750,          // Thời gian hoàn tất lật trang (0.75 giây mượt mà)
      usePortrait: true,          // Tự động chuyển 1 trang (Portrait) trên Mobile, 2 trang (Landscape) trên Desktop
      startPage: safeStartPage,
      autoSize: true,
      useMouseEvents: true,       // Bật kéo góc trang bằng chuột trên PC
      showPageCorners: true,      // Hiệu ứng hé góc mời gọi kéo lật
      clickEventForward: true     // Cho phép bấm nút phóng to ảnh hoặc admin bên trong trang
    });

    // Nạp các trang DOM vào engine PageFlip
    const pageElements = bookEl.querySelectorAll('.page');
    this.pageFlip.loadFromHTML(pageElements);

    // Bắt các sự kiện lật trang
    this.pageFlip.on('flip', (e) => {
      this.audio.play();
      this._updateNavigation();
      this._updateActiveTab();
    });

    this.pageFlip.on('changeOrientation', () => {
      this._updateNavigation();
    });

    this.pageFlip.on('init', () => {
      this._updateNavigation();
      this._updateActiveTab();
    });
  }

  // HTML Bìa Trước (Front Cover)
  _createFrontCoverHTML() {
    return `
      <div class="page-content cover-content">
        <div class="cover-border">
          <div>
            <div class="cover-badge">★ MINTYMART COLLECTION ★</div>
            <div class="cover-logo-box">
              <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e9be55' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2a5 5 0 0 0-5 5c0 2.2 1.4 4.1 3.4 4.8L8 21a2 2 0 0 0 4 0l1-9.2A5 5 0 0 0 12 2z'/%3E%3Cpath d='M9.5 7a2.5 2.5 0 0 1 5 0'/%3E%3C/svg%3E" alt="Minty Logo">
            </div>
            <h1 class="cover-title">THỰC ĐƠN KEM</h1>
            <p class="cover-sub">Tuyển tập những hương vị kem mát lạnh trứ danh từ khắp nơi trên thế giới</p>
          </div>
          <div class="cover-footer">
            <span>MINTYMART · PREMIUM GELATO</span>
            <span class="hint">📖 Bấm hoặc vuốt mép trang để mở ➔</span>
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

  // HTML Trang Ghi Chú & Câu Chuyện Thương Hiệu (Notes Page)
  _createNotesHTML() {
    return `
      <div class="page-content">
        <div class="eyebrow">CÂU CHUYỆN MINTYMART</div>
        <h2 class="toc-title">Cam Kết Chất Lượng</h2>
        <div style="font-size:13px;line-height:1.7;color:var(--mut);margin-top:14px;flex:1">
          <p>Mỗi que kem tại <b>MintyMart</b> đều được bảo quản ở chuẩn nhiệt độ đông sâu âm 18°C, giữ trọn hương vị tươi mát nguyên bản từ nhà sản xuất.</p>
          <div style="margin:20px 0;padding:14px;border:1px dashed var(--gold);border-radius:8px;background:var(--page2)">
            <b style="color:var(--gold);display:block;margin-bottom:6px">🍦 Ưu đãi đặc biệt:</b>
            <span>Mua từ 5 que kem bất kỳ để nhận túi giữ nhiệt chuyên dụng miễn phí!</span>
          </div>
          <p>Quý khách vui lòng liên hệ nhân viên hoặc số hotline tại bìa sau để được giao hàng tận nơi nhanh chóng.</p>
        </div>
        <div class="foot" style="margin-top:auto">
          <span>GHI CHÚ</span>
          <b>${String(this.pageData.length - 1).padStart(2, '0')}</b>
        </div>
      </div>
    `;
  }

  // HTML Bìa Sau (Back Cover)
  _createBackCoverHTML() {
    return `
      <div class="page-content cover-content">
        <div class="cover-border">
          <div class="back-cover-box">
            <div style="font-size:36px;margin-bottom:8px">🍧</div>
            <h3>CẢM ƠN QUÝ KHÁCH</h3>
            <p>Chúc bạn có những phút giây ngọt ngào và sảng khoái cùng kem ngon tại MintyMart.</p>
            <div class="contact-card">
              <div>📍 <b>Địa chỉ:</b> Chi nhánh MintyMart toàn quốc</div>
              <div>📞 <b>Hotline / Zalo:</b> 090x xxx xxx</div>
              <div>⏰ <b>Giờ phục vụ:</b> 08:00 – 22:30 mỗi ngày</div>
              <div>🛵 <b>Giao hàng:</b> GrabFood · ShopeeFood · BeFood</div>
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
    h.style.cssText = 'font-size:clamp(22px, 3.5vw, 30px);margin:6px 0 4px;font-family:Noto Serif, serif;';
    h.textContent = `${p.z.flag} ${p.z.name}`;

    const sub = document.createElement('p');
    sub.className = 'sub';
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
        im.width = 42;
        im.height = 42;
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
    this.pageFlip.turnToPage(target);
  }

  // Lật trang trước
  flipPrev() {
    if (!this.pageFlip) return;
    this.pageFlip.flipPrev();
  }

  // Lật trang sau
  flipNext() {
    if (!this.pageFlip) return;
    this.pageFlip.flipNext();
  }

  // Cập nhật trạng thái hiển thị thanh tiến trình và số trang
  _updateNavigation() {
    if (!this.pageFlip) return;

    const cur = this.pageFlip.getCurrentPageIndex();
    const total = this.pageFlip.getPageCount();
    const isPortrait = this.pageFlip.getOrientation() === 'portrait';

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
        const p1 = cur;
        const p2 = Math.min(cur + 1, total - 1);
        statusEl.textContent = `Trang ${String(p1).padStart(2, '0')} — ${String(p2).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      }
    }

    // Cập nhật nút Trước / Sau
    const prevBtn = document.getElementById(this.prevBtnId);
    const nextBtn = document.getElementById(this.nextBtnId);
    if (prevBtn) prevBtn.disabled = cur <= 0;
    if (nextBtn) nextBtn.disabled = cur >= total - 1;

    // Cập nhật vạch phân đoạn (Segments)
    const segEl = document.getElementById(this.segId);
    if (segEl) {
      segEl.replaceChildren();
      const step = isPortrait ? 1 : 2;
      for (let i = 0; i < total; i += step) {
        const segItem = document.createElement('i');
        if (cur >= i && cur < i + step) segItem.className = 'on';
        segItem.title = `Chuyển tới trang ${i + 1}`;
        segItem.onclick = () => this.turnToPage(i);
        segEl.append(segItem);
      }
    }
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
      btn.textContent = `${z.flag} ${z.short}`;
      btn.onclick = () => {
        this.turnToPage(pageIdx);
      };
      tabsEl.append(btn);
    });
  }

  // Đánh dấu Tab đang hoạt động tương ứng với trang đang mở
  _updateActiveTab() {
    if (!this.pageFlip) return;
    const cur = this.pageFlip.getCurrentPageIndex();
    const currentPage = this.pageData[cur];
    const currentZoneKey = (currentPage && currentPage.z) ? currentPage.z.k : null;

    const tabs = document.querySelectorAll('.tabs .tab');
    tabs.forEach(t => {
      const isCurrent = currentZoneKey && t.textContent.includes(currentPage.z.short);
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

  // Gắn các phím tắt bàn phím
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
  }
}

// Xuất ra phạm vi toàn cục (Global Scope) cho Vanilla JS
window.MintyMenuFlipBook = MintyMenuFlipBook;
window.PaperAudioSynthesizer = PaperAudioSynthesizer;
