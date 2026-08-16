/**
 * BILLFLOW AI - AUTH & 5-MINUTE TESTER COUNTDOWN SERVICE
 * Manages JWT session, live 5-minute ticker, Admin tester account creation & auto-lock
 */

const AuthService = {
  tokenKey: 'billflow_auth_jwt_v1',
  userKey: 'billflow_user_data_v1',
  currentUser: null,
  timerInterval: null,

  // Get saved JWT token
  getToken() {
    return localStorage.getItem(this.tokenKey);
  },

  // Get current user info
  getUser() {
    if (this.currentUser) return this.currentUser;
    const raw = localStorage.getItem(this.userKey);
    if (raw) {
      try {
        this.currentUser = JSON.parse(raw);
        return this.currentUser;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  // Check if logged in
  isLoggedIn() {
    return !!this.getToken();
  },

  // Check if current user is Admin
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // Authenticated fetch wrapper
  async authFetch(url, options = {}) {
    const token = this.getToken();
    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    // Check if account expired or locked
    if (response.status === 401 || response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.code === 'ACCOUNT_EXPIRED' || data.code === 'ACCOUNT_LOCKED') {
        this.handleAccountExpired(data.message);
        throw new Error(data.message || 'Tài khoản đã hết hạn hoặc bị khóa');
      }
      if (response.status === 401 && !url.includes('/api/auth/login')) {
        this.logout(false);
        throw new Error('Phiên đăng nhập đã hết hạn');
      }
    }

    return response;
  },

  // Initialize Auth state
  async init() {
    if (!this.isLoggedIn()) {
      this.showLoginModal();
      return false;
    }

    try {
      const res = await this.authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
        this.syncUI();
        this.startCountdownTimer();
        this.hideLoginModal();
        return true;
      } else {
        this.logout(false);
        return false;
      }
    } catch (err) {
      console.warn('Auth check warning:', err.message);
      this.showLoginModal();
      return false;
    }
  },

  // Login handler
  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Đăng nhập không thành công');
    }

    // Save token & user
    localStorage.setItem(this.tokenKey, data.token);
    localStorage.setItem(this.userKey, JSON.stringify(data.user));
    this.currentUser = data.user;

    this.syncUI();
    this.startCountdownTimer();
    this.hideLoginModal();

    if (window.UIController) {
      UIController.showToast(data.message, 'success');
    }

    // Load user's invoices
    if (window.App && typeof App.loadInvoicesFromDB === 'function') {
      App.loadInvoicesFromDB();
    }

    return data.user;
  },

  // Logout handler
  logout(notify = true) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser = null;

    if (window.App) {
      App.invoices = [];
      App.refreshUI();
    }

    this.showLoginModal();
    if (notify && window.UIController) {
      UIController.showToast('Đã đăng xuất khỏi hệ thống', 'info');
    }
  },

  // Real-time 5-minute countdown ticker for testers
  startCountdownTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const user = this.getUser();
    if (!user || user.role === 'admin') {
      this.updateCountdownBadge(null);
      return;
    }

    const checkTimer = () => {
      const u = this.getUser();
      if (!u || !u.expiresAt) return;

      const expiresMs = new Date(u.expiresAt).getTime();
      const nowMs = Date.now();
      const remainingSec = Math.max(0, Math.floor((expiresMs - nowMs) / 1000));

      this.updateCountdownBadge(remainingSec);

      if (remainingSec <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.handleAccountExpired('Thời hạn 5 phút dùng thử của bạn đã kết thúc. Tài khoản đã tự động khóa!');
      }
    };

    checkTimer();
    this.timerInterval = setInterval(checkTimer, 1000);
  },

  // Format seconds to MM:SS
  formatTimer(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // Update Countdown UI Badge
  updateCountdownBadge(remainingSec) {
    const badge = document.getElementById('userCountdownBadge');
    const textEl = document.getElementById('userCountdownText');
    const user = this.getUser();

    if (!badge || !textEl) return;

    if (!user) {
      badge.style.display = 'none';
      return;
    }

    if (user.role === 'admin') {
      badge.style.display = 'inline-flex';
      badge.className = 'countdown-badge badge-admin';
      badge.innerHTML = `<i data-lucide="shield-check" style="width: 14px; height: 14px; color: #10b981;"></i> <span>Admin (Không giới hạn)</span>`;
    } else if (remainingSec !== null) {
      badge.style.display = 'inline-flex';
      const formatted = this.formatTimer(remainingSec);
      if (remainingSec <= 60) {
        badge.className = 'countdown-badge badge-critical pulse';
        badge.innerHTML = `<i data-lucide="alarm-clock" style="width: 14px; height: 14px; color: #ef4444;"></i> <span>Hết hạn sau: ${formatted}</span>`;
      } else {
        badge.className = 'countdown-badge badge-tester';
        badge.innerHTML = `<i data-lucide="timer" style="width: 14px; height: 14px; color: #f59e0b;"></i> <span>Dùng thử còn: ${formatted}</span>`;
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  // Handle Account Expired Event
  handleAccountExpired(msg) {
    const overlay = document.getElementById('accountExpiredOverlay');
    const overlayMsg = document.getElementById('expiredOverlayMessage');
    if (overlay) {
      if (overlayMsg) overlayMsg.innerText = msg || 'Tài khoản của bạn đã hết hạn 5 phút dùng thử.';
      overlay.style.display = 'flex';
    }

    if (window.UIController) {
      UIController.showToast(msg || 'Tài khoản test của bạn đã hết hạn!', 'error', 6000);
    }
  },

  // Show / Hide Login Modal
  showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
  },

  hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
  },

  // Sync Header & Profile UI
  syncUI() {
    const user = this.getUser();
    const authProfileArea = document.getElementById('authProfileArea');
    const authUsernameText = document.getElementById('authUsernameText');
    const adminManageBtn = document.getElementById('adminManageBtn');

    if (!user) {
      if (authProfileArea) authProfileArea.style.display = 'none';
      return;
    }

    if (authProfileArea) authProfileArea.style.display = 'flex';
    if (authUsernameText) authUsernameText.innerText = user.username;

    // Show Admin button if admin
    if (adminManageBtn) {
      adminManageBtn.style.display = user.role === 'admin' ? 'inline-flex' : 'none';
    }

    // Hide expired overlay if unlocked
    const overlay = document.getElementById('accountExpiredOverlay');
    if (overlay) overlay.style.display = 'none';

    if (window.lucide) lucide.createIcons();
  },

  // ================= ADMIN MANAGEMENT API =================
  async getAdminUsers() {
    const res = await this.authFetch('/api/auth/users');
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể lấy danh sách người dùng');
    return data.users;
  },

  async createTesterAccount(username, password, durationMinutes = 5, note = '') {
    const res = await this.authFetch('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, durationMinutes, note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể tạo tài khoản');
    return data;
  },

  async toggleUserLock(userId, isLocked) {
    const res = await this.authFetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isLocked })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể thay đổi trạng thái');
    return data;
  },

  async extendUserTime(userId, extraMinutes = 5) {
    const res = await this.authFetch(`/api/auth/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ extendMinutes: extraMinutes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể gia hạn');
    return data;
  },

  async deleteUser(userId) {
    const res = await this.authFetch(`/api/auth/users/${userId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Không thể xóa tài khoản');
    return data;
  }
};
