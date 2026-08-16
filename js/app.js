/**
 * BILLFLOW AI - MAIN APPLICATION CONTROLLER
 * Fullstack MongoDB Edition: Real-time Invoices, JWT Auth, 5-Minute Tester Auto-Lock
 */

const App = {
  invoices: [],
  selectedIds: new Set(),

  // Initialize App
  async init() {
    this.bindEvents();
    
    // Check and initialize Auth
    const isAuth = await AuthService.init();
    if (isAuth) {
      await this.loadInvoicesFromDB();
    } else {
      this.refreshUI();
    }

    if (window.lucide) lucide.createIcons();
    console.log('BillFlow AI MongoDB Engine initialized.');
  },

  // Load Invoices from MongoDB via Backend API
  async loadInvoicesFromDB() {
    try {
      const res = await AuthService.authFetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        this.invoices = (data.invoices || []).map(inv => {
          if (!inv.id && inv._id) inv.id = inv._id.toString();
          return inv;
        });
        this.refreshUI();
      }
    } catch (err) {
      console.warn('Load invoices warning:', err.message);
      this.invoices = [];
      this.refreshUI();
    }
  },

  // Refresh entire UI
  refreshUI() {
    const searchVal = document.getElementById('searchInput')?.value || '';
    const catVal = document.getElementById('categoryFilter')?.value || 'all';

    UIController.updateStatsRibbon(this.invoices);
    UIController.renderDataGrid(this.invoices, searchVal, catVal);
    this.updateBatchQueueDisplay();
  },

  // Batch Processing Queue Handler
  async processFiles(files) {
    if (!files || files.length === 0) return;

    if (!AuthService.isLoggedIn()) {
      AuthService.showLoginModal();
      return;
    }

    const queueContainer = document.getElementById('fileQueueSection');
    const queueList = document.getElementById('queueItemsGrid');
    if (queueContainer) queueContainer.style.display = 'block';

    UIController.showToast(`Bắt đầu xử lý hàng loạt ${files.length} hóa đơn...`, 'info');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = 'temp_' + Date.now() + '_' + i;

      // Add temporary card in queue
      const card = document.createElement('div');
      card.id = tempId;
      card.className = 'queue-item-card active';
      card.innerHTML = `
        <div class="queue-thumb">
          <i data-lucide="file-text" style="width: 20px; height: 20px; color: var(--primary);"></i>
        </div>
        <div class="queue-info">
          <div class="queue-name">${file.name}</div>
          <div class="queue-size">${(file.size / 1024).toFixed(0)} KB</div>
          <span class="queue-status-badge status-loading">
            <i data-lucide="loader-2" class="spin" style="width: 10px; height: 10px;"></i> Đang đọc AI...
          </span>
        </div>
      `;
      if (queueList) queueList.prepend(card);
      if (window.lucide) lucide.createIcons();

      try {
        // Extract invoice data via Backend Gemini API (.env)
        const extracted = await AIService.extractInvoiceFromImage(file, progress => {
          const badge = card.querySelector('.queue-status-badge');
          if (badge) badge.innerText = progress.message;
        });

        // Save to MongoDB
        const saveRes = await AuthService.authFetch('/api/invoices', {
          method: 'POST',
          body: JSON.stringify(extracted)
        });

        const saveData = await saveRes.json();
        const savedInvoice = saveData.invoice || extracted;
        if (!savedInvoice.previewUrl && extracted.previewUrl) {
          savedInvoice.previewUrl = extracted.previewUrl;
        }
        if (!savedInvoice.id && savedInvoice._id) {
          savedInvoice.id = savedInvoice._id.toString();
        }

        // Add to main invoices array at top
        this.invoices.unshift(savedInvoice);
        this.refreshUI();

        // Update queue item card to Done
        card.classList.remove('active');
        const badge = card.querySelector('.queue-status-badge');
        if (badge) {
          badge.className = 'queue-status-badge status-done';
          badge.innerHTML = `<i data-lucide="check" style="width: 10px; height: 10px;"></i> Đã lưu vào DB`;
        }

        UIController.showToast(`Bóc tách & Lưu MongoDB thành công HĐ #${savedInvoice.invoiceNo || 'mới'}`, 'success');
      } catch (err) {
        console.error('Error processing file:', err);
        const badge = card.querySelector('.queue-status-badge');
        if (badge) {
          badge.className = 'queue-status-badge status-warning';
          badge.innerText = err.message || 'Lỗi xử lý';
        }
      }
    }

    setTimeout(() => {
      if (window.lucide) lucide.createIcons();
    }, 500);
  },

  updateBatchQueueDisplay() {
    const count = this.invoices.length;
    const badge = document.getElementById('queueCountBadge');
    if (badge) badge.innerText = `${count} chứng từ`;
  },

  // Open Reviewer for an invoice
  openReviewer(id) {
    const inv = this.invoices.find(item => item.id === id || item._id === id);
    if (inv) {
      UIController.openReviewer(inv);
    }
  },

  // Save changes from Reviewer Pane to MongoDB
  async saveReviewerChanges() {
    const id = UIController.activeInvoiceId;
    if (!id) return;

    const invIndex = this.invoices.findIndex(item => item.id === id || item._id === id);
    if (invIndex === -1) return;

    // Collect updated line items
    const itemRows = document.querySelectorAll('#revItemsTableBody tr');
    const updatedItems = [];
    itemRows.forEach(row => {
      const name = row.querySelector('.item-name')?.value;
      if (name) {
        updatedItems.push({
          name,
          unit: row.querySelector('.item-unit')?.value || 'Cái',
          quantity: parseFloat(row.querySelector('.item-qty')?.value) || 1,
          price: parseFloat(row.querySelector('.item-price')?.value) || 0,
          amount: parseFloat(row.querySelector('.item-amount')?.value) || 0
        });
      }
    });

    const subtotal = Number(document.getElementById('revSubtotal').value) || 0;
    const vatRate = Number(document.getElementById('revVatRate').value) || 0;
    const vatAmount = Number(document.getElementById('revVatAmount').value) || 0;
    const total = Number(document.getElementById('revTotal').value) || 0;

    const updatePayload = {
      title: document.getElementById('revTitle').value,
      invoiceNo: document.getElementById('revInvoiceNo').value,
      symbol: document.getElementById('revSymbol').value,
      date: document.getElementById('revDate').value,
      category: document.getElementById('revCategory').value,
      paymentMethod: document.getElementById('revPaymentMethod').value,
      vendor: {
        name: document.getElementById('revVendorName').value,
        taxCode: document.getElementById('revVendorTaxCode').value,
        address: document.getElementById('revVendorAddress').value
      },
      buyer: {
        name: document.getElementById('revBuyerName').value,
        taxCode: document.getElementById('revBuyerTaxCode').value
      },
      items: updatedItems,
      subtotal,
      vatRate,
      vatAmount,
      total,
      status: 'verified'
    };

    try {
      const res = await AuthService.authFetch(`/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      this.invoices[invIndex] = { ...this.invoices[invIndex], ...updatePayload };
      this.refreshUI();
      UIController.showToast('Đã lưu và cập nhật hóa đơn vào MongoDB thành công!', 'success');
    } catch (err) {
      UIController.showToast('Lỗi lưu hóa đơn: ' + err.message, 'error');
    }
  },

  // Delete invoice from MongoDB
  async deleteInvoice(id) {
    if (confirm('Bạn có chắc chắn muốn xóa hóa đơn này khỏi cơ sở dữ liệu MongoDB?')) {
      try {
        const res = await AuthService.authFetch(`/api/invoices/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message);
        }

        this.invoices = this.invoices.filter(i => (i.id !== id && i._id !== id));
        if (UIController.activeInvoiceId === id) {
          UIController.closeReviewer();
        }
        this.refreshUI();
        UIController.showToast('Đã xóa hóa đơn khỏi MongoDB', 'info');
      } catch (err) {
        UIController.showToast('Lỗi khi xóa: ' + err.message, 'error');
      }
    }
  },

  // Clear all invoices from MongoDB
  async clearAllInvoices() {
    if (confirm('Xóa toàn bộ danh sách hóa đơn của bạn trong MongoDB?')) {
      try {
        const res = await AuthService.authFetch('/api/invoices', {
          method: 'DELETE'
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message);
        }

        this.invoices = [];
        this.refreshUI();
        UIController.closeReviewer();
        UIController.showToast('Đã dọn dẹp sạch toàn bộ hóa đơn', 'info');
      } catch (err) {
        UIController.showToast('Lỗi dọn dẹp: ' + err.message, 'error');
      }
    }
  },

  // Rescan active invoice in reviewer
  async rescanCurrentInvoice() {
    const id = UIController.activeInvoiceId;
    if (!id) return;

    const invIndex = this.invoices.findIndex(item => item.id === id || item._id === id);
    if (invIndex === -1) return;

    const currentInv = this.invoices[invIndex];
    if (!currentInv.previewUrl) {
      UIController.showToast('Không tìm thấy ảnh chứng từ gốc để quét lại', 'error');
      return;
    }

    UIController.showToast('Gemini Vision AI đang đọc lại toàn bộ ảnh chứng từ...', 'info');

    try {
      const extracted = await AIService.extractInvoiceFromImage(currentInv.previewUrl, progress => {
        UIController.showToast(progress.message, 'info', 1500);
      });

      extracted.id = currentInv.id || currentInv._id;
      extracted.previewUrl = currentInv.previewUrl;
      extracted.fileName = currentInv.fileName;

      // Update in MongoDB
      await AuthService.authFetch(`/api/invoices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(extracted)
      });

      this.invoices[invIndex] = extracted;
      this.refreshUI();
      UIController.openReviewer(extracted);

      UIController.showToast('Đã quét lại và cập nhật MongoDB thành công!', 'success');
    } catch (err) {
      UIController.showToast('Lỗi khi quét: ' + err.message, 'error');
    }
  },

  // ================= EXPORT HANDLERS =================
  exportMisa() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào để xuất file!', 'error');
      return;
    }
    ExcelExportService.exportMisaFormat(this.invoices);
    UIController.showToast('Đã xuất file Excel mẫu MISA SME/AMIS thành công!', 'success');
  },

  exportHtkk() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào để xuất file!', 'error');
      return;
    }
    ExcelExportService.exportHtkkFormat(this.invoices);
    UIController.showToast('Đã xuất Bảng kê Thuế Mẫu 01-2/GTGT thành công!', 'success');
  },

  exportExcel() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào để xuất file!', 'error');
      return;
    }
    ExcelExportService.exportToExcel(this.invoices);
    UIController.showToast('Đã xuất file Excel (.xlsx) 2-Sheet thành công!', 'success');
  },

  exportCsv() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào để xuất file!', 'error');
      return;
    }
    ExcelExportService.exportToCsv(this.invoices);
    UIController.showToast('Đã xuất file CSV thành công!', 'success');
  },

  exportJson() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào để xuất file!', 'error');
      return;
    }
    ExcelExportService.exportToJson(this.invoices);
    UIController.showToast('Đã xuất file JSON thành công!', 'success');
  },

  copyForGoogleSheets() {
    if (this.invoices.length === 0) {
      UIController.showToast('Chưa có hóa đơn nào!', 'error');
      return;
    }
    ExcelExportService.copyForGoogleSheets(this.invoices)
      .then(() => {
        UIController.showToast('Đã copy dữ liệu! Bạn chỉ cần nhấn Ctrl + V vào Google Sheets', 'success', 4000);
      })
      .catch(() => {
        UIController.showToast('Không thể copy vào clipboard tự động', 'error');
      });
  },

  // ================= AUTH LOGIN SUBMIT =================
  async handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const u = document.getElementById('loginUsername')?.value.trim();
    const p = document.getElementById('loginPassword')?.value.trim();
    const errEl = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (!u || !p) {
      if (errEl) {
        errEl.innerText = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!';
        errEl.style.display = 'block';
      }
      return;
    }

    if (errEl) errEl.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i data-lucide="loader-2" class="spin" style="width: 18px; height: 18px;"></i> Đang xác thực...`;
      if (window.lucide) lucide.createIcons();
    }

    try {
      await AuthService.login(u, p);
    } catch (err) {
      if (errEl) {
        errEl.innerText = err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác';
        errEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Đăng Nhập Hệ Thống`;
        if (window.lucide) lucide.createIcons();
      }
    }
  },

  // ================= ADMIN USER MANAGEMENT =================
  async openAdminUsersModal() {
    if (!AuthService.isAdmin()) {
      UIController.showToast('Chỉ Quản trị viên (Admin) mới có quyền truy cập chức năng này!', 'error');
      return;
    }

    this.openModal('adminUsersModal');
    await this.refreshAdminUsersList();
  },

  async refreshAdminUsersList() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;"><i data-lucide="loader-2" class="spin" style="width: 20px; height: 20px;"></i> Đang tải dữ liệu người dùng...</td></tr>`;
    if (window.lucide) lucide.createIcons();

    try {
      const users = await AuthService.getAdminUsers();
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Chưa có tài khoản test nào được cấp. Hãy nhấn "Cấp tài khoản mới" ở trên.</td></tr>`;
        return;
      }

      tbody.innerHTML = users.map((u, idx) => {
        let statusBadge = '';
        if (u.isLocked) {
          statusBadge = '<span class="badge-status-locked">Đã Khóa</span>';
        } else if (u.status === 'expired') {
          statusBadge = '<span class="badge-status-expired">Hết hạn (5p)</span>';
        } else if (u.status === 'pending') {
          statusBadge = '<span class="badge-status-pending">Chưa đăng nhập</span>';
        } else {
          statusBadge = '<span class="badge-status-active">Đang hoạt động</span>';
        }

        const remSec = u.remainingSeconds || 0;
        const timeText = u.status === 'pending' ? `${u.durationMinutes} phút (chờ kích hoạt)` :
          remSec > 0 ? `${AuthService.formatTimer(remSec)}` : '00:00';

        return `
          <tr>
            <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
            <td style="font-weight: 700; color: var(--text-main); font-family: 'JetBrains Mono', monospace;">${u.username}</td>
            <td>${u.durationMinutes} phút</td>
            <td style="font-family: 'JetBrains Mono', monospace; color: ${remSec > 0 ? '#38bdf8' : '#ef4444'}; font-weight: 600;">${timeText}</td>
            <td>${statusBadge}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${u.note || '---'}</td>
            <td style="text-align: right;">
              <div style="display: flex; justify-content: flex-end; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="App.handleExtendUser('${u.id}', 5)" title="Cộng thêm 5 phút">
                  <i data-lucide="plus-circle" style="width: 12px; height: 12px; color: #10b981;"></i> +5p
                </button>
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="App.handleToggleLock('${u.id}', ${!u.isLocked})" title="${u.isLocked ? 'Mở khóa' : 'Khóa tài khoản'}">
                  <i data-lucide="${u.isLocked ? 'unlock' : 'lock'}" style="width: 12px; height: 12px; color: ${u.isLocked ? '#38bdf8' : '#f59e0b'};"></i>
                </button>
                <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="App.handleDeleteUser('${u.id}', '${u.username}')" title="Xóa tài khoản">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444;"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 1.5rem;">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
  },

  async handleCreateTester(e) {
    e.preventDefault();
    const userEl = document.getElementById('newTesterUsername');
    const passEl = document.getElementById('newTesterPassword');
    const durationEl = document.getElementById('newTesterDuration');
    const noteEl = document.getElementById('newTesterNote');

    const username = userEl?.value.trim();
    const password = passEl?.value.trim();
    const duration = parseInt(durationEl?.value, 10) || 5;
    const note = noteEl?.value.trim() || '';

    if (!username || !password) {
      UIController.showToast('Vui lòng nhập tên đăng nhập và mật khẩu!', 'error');
      return;
    }

    try {
      const res = await AuthService.createTesterAccount(username, password, duration, note);
      UIController.showToast(res.message, 'success');
      if (userEl) userEl.value = '';
      if (passEl) passEl.value = '';
      if (noteEl) noteEl.value = '';
      await this.refreshAdminUsersList();
    } catch (err) {
      UIController.showToast('Lỗi tạo tài khoản: ' + err.message, 'error');
    }
  },

  async handleToggleLock(userId, lockStatus) {
    try {
      const res = await AuthService.toggleUserLock(userId, lockStatus);
      UIController.showToast(lockStatus ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', 'info');
      await this.refreshAdminUsersList();
    } catch (err) {
      UIController.showToast('Lỗi: ' + err.message, 'error');
    }
  },

  async handleExtendUser(userId, minutes = 5) {
    try {
      const res = await AuthService.extendUserTime(userId, minutes);
      UIController.showToast(`Đã cộng thêm ${minutes} phút thành công!`, 'success');
      await this.refreshAdminUsersList();
    } catch (err) {
      UIController.showToast('Lỗi gia hạn: ' + err.message, 'error');
    }
  },

  async handleDeleteUser(userId, username) {
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản test "${username}"?`)) {
      try {
        const res = await AuthService.deleteUser(userId);
        UIController.showToast(res.message, 'info');
        await this.refreshAdminUsersList();
      } catch (err) {
        UIController.showToast('Lỗi xóa tài khoản: ' + err.message, 'error');
      }
    }
  },

  // Bind all UI event listeners
  bindEvents() {
    const dropzone = document.getElementById('dropzoneArea');
    const fileInput = document.getElementById('fileInput');

    // Drag & Drop
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => {
        if (!AuthService.isLoggedIn()) {
          AuthService.showLoginModal();
          return;
        }
        fileInput.click();
      });
      
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (!AuthService.isLoggedIn()) {
          AuthService.showLoginModal();
          return;
        }
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.processFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.processFiles(e.target.files);
          fileInput.value = ''; // reset
        }
      });
    }

    // Search and Filter
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.refreshUI());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.refreshUI());
    }

    // Select All Checkbox
    const selectAllBox = document.getElementById('selectAllCheckbox');
    if (selectAllBox) {
      selectAllBox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.row-checkbox').forEach(cb => {
          cb.checked = checked;
        });
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        UIController.closeReviewer();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (document.getElementById('reviewerCard')?.classList.contains('open')) {
          e.preventDefault();
          this.saveReviewerChanges();
        }
      }
    });

    // Image Pan dragging inside Reviewer
    const canvasArea = document.getElementById('docCanvasArea');
    if (canvasArea) {
      canvasArea.addEventListener('mousedown', (e) => {
        UIController.isDraggingImage = true;
        UIController.dragStartX = e.clientX - UIController.panX;
        UIController.dragStartY = e.clientY - UIController.panY;
        canvasArea.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (UIController.isDraggingImage) {
          UIController.panX = e.clientX - UIController.dragStartX;
          UIController.panY = e.clientY - UIController.dragStartY;
          UIController.applyDocTransform();
        }
      });

      window.addEventListener('mouseup', () => {
        UIController.isDraggingImage = false;
        if (canvasArea) canvasArea.style.cursor = 'grab';
      });
    }
  },

  // Modals management
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (modalId === 'analyticsModal') {
        UIController.renderAnalytics(this.invoices);
      }
      if (modalId === 'allItemsModal') {
        UIController.renderAllItemsModal(this.invoices);
      }
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
  }
};

// Start application when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
