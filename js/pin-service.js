/**
 * BILLFLOW AI - PIN CODE & USAGE TRIAL MANAGEMENT SERVICE
 * Manages 2-trial free usage limit, persistent local storage lock, and PIN verification.
 */

const PinService = {
  // Configuration
  MAX_FREE_TESTS: 2,
  
  // List of valid PIN codes (You can add or customize PIN codes here)
  VALID_PINS: [
    '888888',
    '999999',
    'VIP2026',
    '686868',
    '123456',
    '2026',
    'BILLFLOW2026',
    'ADMIN88'
  ],

  // Storage Keys
  STORAGE_KEYS: {
    USAGE_COUNT: 'bf_trial_usage_v2',
    IS_UNLOCKED: 'bf_pin_unlocked_v2',
    PIN_TOKEN: 'bf_pin_token_v2'
  },

  // Initialize service
  init() {
    this.syncUI();
    console.log(`[PinService] Initialized. Unlocked: ${this.isUnlocked()}, Used: ${this.getUsageCount()}/${this.MAX_FREE_TESTS}`);
  },

  // Check if user has entered a valid PIN
  isUnlocked() {
    try {
      const unlocked = localStorage.getItem(this.STORAGE_KEYS.IS_UNLOCKED);
      const token = localStorage.getItem(this.STORAGE_KEYS.PIN_TOKEN);
      return unlocked === 'true' && !!token;
    } catch (e) {
      return false;
    }
  },

  // Get current trial usage count (defaults to 0)
  getUsageCount() {
    try {
      const val = localStorage.getItem(this.STORAGE_KEYS.USAGE_COUNT);
      const count = parseInt(val, 10);
      return isNaN(count) ? 0 : Math.max(0, count);
    } catch (e) {
      return 0;
    }
  },

  // Get remaining free trials
  getRemainingTrials() {
    if (this.isUnlocked()) return Infinity;
    return Math.max(0, this.MAX_FREE_TESTS - this.getUsageCount());
  },

  // Check if user can perform a test/scan/bóc tách
  canPerformTest() {
    if (this.isUnlocked()) return true;
    return this.getUsageCount() < this.MAX_FREE_TESTS;
  },

  // Record a trial test usage
  consumeTrial(amount = 1) {
    if (this.isUnlocked()) return true;

    let current = this.getUsageCount();
    current += amount;
    
    try {
      localStorage.setItem(this.STORAGE_KEYS.USAGE_COUNT, current.toString());
    } catch (e) {
      console.warn('[PinService] LocalStorage error:', e);
    }

    this.syncUI();
    return current <= this.MAX_FREE_TESTS;
  },

  // Verify PIN code entered by user
  verifyPin(inputPin) {
    if (!inputPin) return false;
    const cleanPin = inputPin.trim().toUpperCase();
    return this.VALID_PINS.some(p => p.toUpperCase() === cleanPin);
  },

  // Unlock system with PIN
  unlockWithPin(inputPin) {
    if (!this.verifyPin(inputPin)) {
      return false;
    }

    try {
      localStorage.setItem(this.STORAGE_KEYS.IS_UNLOCKED, 'true');
      localStorage.setItem(this.STORAGE_KEYS.PIN_TOKEN, 'token_' + btoa(inputPin.trim() + '_' + Date.now()));
    } catch (e) {
      console.error('[PinService] Error saving unlock token:', e);
    }

    this.syncUI();
    return true;
  },

  // Lock system (for admin testing / reset)
  lock() {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.IS_UNLOCKED);
      localStorage.removeItem(this.STORAGE_KEYS.PIN_TOKEN);
    } catch (e) {}
    this.syncUI();
  },

  // Reset usage count (for admin testing)
  resetUsage() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.USAGE_COUNT, '0');
    } catch (e) {}
    this.syncUI();
  },

  // Open PIN Modal with optional custom message
  openPinModal(customMsg = null) {
    const modal = document.getElementById('pinModal');
    if (!modal) return;

    const msgEl = document.getElementById('pinModalNotice');
    if (msgEl) {
      if (customMsg) {
        msgEl.innerHTML = customMsg;
      } else if (this.isUnlocked()) {
        msgEl.innerHTML = `✨ <strong>Hệ thống đã mở khóa VIP!</strong> Bạn có thể nhập mã PIN khác hoặc đặt lại quyền test.`;
      } else if (!this.canPerformTest()) {
        msgEl.innerHTML = `🔒 <strong>Bạn đã dùng hết ${this.MAX_FREE_TESTS} lượt test miễn phí!</strong> Vui lòng nhập mã PIN để tiếp tục bóc tách không giới hạn.`;
      } else {
        msgEl.innerHTML = `🔑 Bạn còn <strong>${this.getRemainingTrials()}/${this.MAX_FREE_TESTS}</strong> lượt dùng thử miễn phí. Nhập mã PIN bất cứ lúc nào để nâng cấp VIP vĩnh viễn.`;
      }
    }

    const pinInput = document.getElementById('pinCodeInput');
    if (pinInput) {
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 150);
    }

    const errorMsg = document.getElementById('pinErrorMessage');
    if (errorMsg) errorMsg.style.display = 'none';

    modal.classList.add('active');
  },

  // Close PIN Modal
  closePinModal() {
    const modal = document.getElementById('pinModal');
    if (modal) modal.classList.remove('active');
  },

  // Handle PIN form submission
  submitPin() {
    const inputEl = document.getElementById('pinCodeInput');
    const errorEl = document.getElementById('pinErrorMessage');
    const pinBox = document.getElementById('pinInputBoxWrapper');

    if (!inputEl) return;
    const pin = inputEl.value.trim();

    if (!pin) {
      if (errorEl) {
        errorEl.innerText = 'Vui lòng nhập mã PIN để xác thực!';
        errorEl.style.display = 'block';
      }
      if (pinBox) {
        pinBox.classList.add('shake');
        setTimeout(() => pinBox.classList.remove('shake'), 600);
      }
      return;
    }

    const success = this.unlockWithPin(pin);

    if (success) {
      if (errorEl) errorEl.style.display = 'none';
      this.closePinModal();
      
      if (window.UIController) {
        UIController.showToast('🎉 Xác thực mã PIN thành công! Đã mở khóa quyền sử dụng không giới hạn.', 'success', 5000);
      }
      
      // Refresh App UI
      if (window.App && typeof App.refreshUI === 'function') {
        App.refreshUI();
      }
    } else {
      if (errorEl) {
        errorEl.innerText = '❌ Mã PIN không chính xác. Vui lòng kiểm tra lại hoặc liên hệ quản trị viên!';
        errorEl.style.display = 'block';
      }
      if (pinBox) {
        pinBox.classList.add('shake');
        setTimeout(() => pinBox.classList.remove('shake'), 600);
      }
    }
  },

  // Synchronize UI elements based on current lock / trial status
  syncUI() {
    const isUnlocked = this.isUnlocked();
    const used = this.getUsageCount();
    const isLocked = !isUnlocked && used >= this.MAX_FREE_TESTS;
    const remaining = Math.max(0, this.MAX_FREE_TESTS - used);

    // 1. Header PIN button status
    const headerPinBtn = document.getElementById('headerPinStatusBtn');
    const headerPinText = document.getElementById('headerPinStatusText');
    const headerPinDot = document.getElementById('headerPinStatusDot');

    if (headerPinText) {
      if (isUnlocked) {
        headerPinText.innerText = 'VIP Không giới hạn';
        if (headerPinDot) headerPinDot.style.background = '#10b981';
        if (headerPinBtn) {
          headerPinBtn.className = 'btn btn-secondary btn-sm btn-pin-unlocked';
          headerPinBtn.title = 'Hệ thống đã mở khóa bằng mã PIN';
        }
      } else if (isLocked) {
        headerPinText.innerText = 'Đã hết lượt test (Khóa)';
        if (headerPinDot) headerPinDot.style.background = '#ef4444';
        if (headerPinBtn) {
          headerPinBtn.className = 'btn btn-primary btn-sm btn-pin-locked';
          headerPinBtn.title = 'Nhấn để nhập mã PIN mở khóa';
        }
      } else {
        headerPinText.innerText = `Dùng thử: ${used}/${this.MAX_FREE_TESTS} lượt`;
        if (headerPinDot) headerPinDot.style.background = '#f59e0b';
        if (headerPinBtn) {
          headerPinBtn.className = 'btn btn-secondary btn-sm';
          headerPinBtn.title = `Còn ${remaining} lượt test miễn phí. Nhấn để nhập mã PIN.`;
        }
      }
    }

    // 2. Quota Banner
    const quotaBadge = document.querySelector('.quota-badge');
    const quotaText = document.getElementById('quotaText');
    const quotaFill = document.getElementById('quotaFill');

    if (quotaBadge && quotaText && quotaFill) {
      if (isUnlocked) {
        quotaBadge.innerText = 'Gói VIP Không Giới Hạn';
        quotaBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        quotaBadge.style.color = '#34d399';
        quotaBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        quotaText.innerText = 'Đã kích hoạt bản quyền PIN (Vô hạn)';
        quotaFill.style.width = '100%';
        quotaFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
      } else if (isLocked) {
        quotaBadge.innerText = 'ĐÃ HẾT LƯỢT DÙNG THỬ';
        quotaBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        quotaBadge.style.color = '#f87171';
        quotaBadge.style.borderColor = 'rgba(239, 68, 68, 0.5)';
        quotaText.innerText = `${used}/${this.MAX_FREE_TESTS} Lượt - CẦN NHẬP MÃ PIN`;
        quotaFill.style.width = '100%';
        quotaFill.style.background = '#ef4444';
      } else {
        quotaBadge.innerText = 'Gói Dùng Thử (2 Lượt Test)';
        quotaBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        quotaBadge.style.color = '#fbbf24';
        quotaBadge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        const pct = Math.round((used / this.MAX_FREE_TESTS) * 100);
        quotaText.innerText = `Đã test ${used}/${this.MAX_FREE_TESTS} lượt (Còn ${remaining} lượt)`;
        quotaFill.style.width = `${pct}%`;
        quotaFill.style.background = 'linear-gradient(90deg, #3b82f6, #6366f1)';
      }
    }

    // 3. Dropzone Locked Overlay
    const dropzoneLockOverlay = document.getElementById('dropzoneLockOverlay');
    const dropzoneArea = document.getElementById('dropzoneArea');
    if (dropzoneLockOverlay && dropzoneArea) {
      if (isLocked) {
        dropzoneLockOverlay.style.display = 'flex';
        dropzoneArea.classList.add('is-locked');
      } else {
        dropzoneLockOverlay.style.display = 'none';
        dropzoneArea.classList.remove('is-locked');
      }
    }

    if (window.lucide) lucide.createIcons();
  }
};
