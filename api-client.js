/**
 * MintyMart API Client - Kết nối Frontend với MongoDB Backend
 * Tự động đồng bộ dữ liệu với Backend khi server hoạt động,
 * và tự động fallback về localStorage khi offline.
 */

const API_BASE = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '' // file:// protocol (mở trực tiếp)
) ? 'http://localhost:5000/api' : '/api';

class MintyApiClient {
  constructor() {
    this.token = localStorage.getItem('mm_token') || null;
    this.isOnline = false;
  }

  // Kiểm tra kết nối Backend
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        this.isOnline = true;
        return true;
      }
    } catch (e) {
      this.isOnline = false;
    }
    return false;
  }

  // Lấy dữ liệu Menu từ MongoDB (luôn lấy dữ liệu mới nhất, không cache)
  async getMenu() {
    try {
      const url = `${API_BASE}/menu?_t=${Date.now()}`;
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(15000), // Cho phép tải an toàn dữ liệu kèm ảnh base64
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.isOnline = true;
          return json.data;
        }
      }
    } catch (e) {
      console.warn('getMenu error/timeout:', e);
      this.isOnline = false;
    }
    return null;
  }

  // Đăng nhập Admin
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (json.success && json.token) {
      this.token = json.token;
      localStorage.setItem('mm_token', json.token);
    }
    return json;
  }

  // Đăng xuất Admin
  logout() {
    this.token = null;
    localStorage.removeItem('mm_token');
  }

  // Thêm món kem mới vào MongoDB
  async addItem(itemData) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(itemData),
    });
    return res.json();
  }

  // Sửa món kem trong MongoDB
  async updateItem(id, itemData) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(itemData),
    });
    return res.json();
  }

  // Xóa món kem trong MongoDB
  async deleteItem(id) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return res.json();
  }

  // Thêm khu vực mới trong MongoDB
  async addZone(zoneData) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/zones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(zoneData),
    });
    return res.json();
  }

  // Sửa khu vực trong MongoDB
  async updateZone(key, zoneData) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/zones/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(zoneData),
    });
    return res.json();
  }

  // Xóa khu vực trong MongoDB
  async deleteZone(key) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/zones/${key}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    return res.json();
  }

  // Lấy cài đặt trang bìa
  async getCover() {
    try {
      const res = await fetch(`${API_BASE}/settings/cover`);
      if (res.ok) {
        const json = await res.json();
        return json.cover;
      }
    } catch (e) {}
    return null;
  }

  // Cập nhật cài đặt trang bìa (Admin)
  async updateCover(coverData) {
    if (!this.token) throw new Error('Cần đăng nhập Admin.');
    const res = await fetch(`${API_BASE}/settings/cover`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(coverData),
    });
    return res.json();
  }
}

window.mintyApi = new MintyApiClient();
