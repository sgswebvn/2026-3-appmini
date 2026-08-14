/**
 * BILLFLOW AI - MAIN APPLICATION CONTROLLER
 * Orchestrates State, Batch Queue, Event Listeners & Local Storage Persistence
 */

const App = {
  invoices: [],
  selectedIds: new Set(),

  // Initialize App
  init() {
    this.loadState();
    this.bindEvents();
    
    // If no invoices exist in storage, load sample invoices for instant WOW effect
    if (this.invoices.length === 0) {
      this.loadSampleData(false);
    } else {
      this.refreshUI();
    }

    // Set Gemini Key input if exists
    const savedKey = AIService.getApiKey();
    const keyInput = document.getElementById('apiKeyInput');
    if (keyInput && savedKey) keyInput.value = savedKey;
    this.updateAiStatusIndicator();

    if (window.lucide) lucide.createIcons();
    console.log('BillFlow AI initialized successfully.');
  },

  // Save to LocalStorage
  saveState() {
    try {
      // Store metadata (exclude oversized preview strings if needed)
      localStorage.setItem('billflow_invoices_data', JSON.stringify(this.invoices));
    } catch (e) {
      console.warn('Storage quota warning, keeping active session in memory');
    }
  },

  // Load from LocalStorage
  loadState() {
    const raw = localStorage.getItem('billflow_invoices_data');
    if (raw) {
      try {
        this.invoices = JSON.parse(raw);
      } catch (e) {
        this.invoices = [];
      }
    }
  },

  // Load Sample Invoices
  loadSampleData(notify = true) {
    const samples = SampleDataService.getSamples();
    this.invoices = [...samples];
    this.saveState();
    this.refreshUI();
    if (notify) {
      UIController.showToast('Đã nạp 4 hóa đơn mẫu thực tế thành công!', 'success');
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
        const extracted = await AIService.extractInvoiceFromImage(file, progress => {
          const badge = card.querySelector('.queue-status-badge');
          if (badge) badge.innerText = progress.message;
        });

        // Add to main invoices array at top
        this.invoices.unshift(extracted);
        this.saveState();
        this.refreshUI();

        // Update queue item card to Done
        card.classList.remove('active');
        const badge = card.querySelector('.queue-status-badge');
        if (badge) {
          badge.className = 'queue-status-badge status-done';
          badge.innerHTML = `<i data-lucide="check" style="width: 10px; height: 10px;"></i> Bóc tách xong`;
        }

        UIController.showToast(`Bóc tách thành công HĐ #${extracted.invoiceNo || 'mới'}`, 'success');
      } catch (err) {
        console.error('Error processing file:', err);
        const badge = card.querySelector('.queue-status-badge');
        if (badge) {
          badge.className = 'queue-status-badge status-warning';
          badge.innerText = 'Lỗi xử lý';
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
    const inv = this.invoices.find(item => item.id === id);
    if (inv) {
      UIController.openReviewer(inv);
    }
  },

  // Save changes from Reviewer Pane
  saveReviewerChanges() {
    const id = UIController.activeInvoiceId;
    if (!id) return;

    const invIndex = this.invoices.findIndex(item => item.id === id);
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

    this.invoices[invIndex] = {
      ...this.invoices[invIndex],
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

    this.saveState();
    this.refreshUI();
    UIController.showToast('Đã lưu và cập nhật hóa đơn thành công!', 'success');
  },

  // Delete invoice
  deleteInvoice(id) {
    if (confirm('Bạn có chắc chắn muốn xóa hóa đơn này khỏi danh sách?')) {
      this.invoices = this.invoices.filter(i => i.id !== id);
      if (UIController.activeInvoiceId === id) {
        UIController.closeReviewer();
      }
      this.saveState();
      this.refreshUI();
      UIController.showToast('Đã xóa hóa đơn', 'info');
    }
  },

  // Clear all
  clearAllInvoices() {
    if (confirm('Xóa toàn bộ danh sách hóa đơn hiện tại?')) {
      this.invoices = [];
      this.saveState();
      this.refreshUI();
      UIController.closeReviewer();
      UIController.showToast('Đã dọn dẹp danh sách', 'info');
    }
  },

  // Export handlers
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

  // Bind all UI event listeners
  bindEvents() {
    const dropzone = document.getElementById('dropzoneArea');
    const fileInput = document.getElementById('fileInput');

    // Drag & Drop
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      
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
        if (document.getElementById('reviewerCard').classList.contains('open')) {
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
  },

  // Rescan active invoice in reviewer
  async rescanCurrentInvoice() {
    const id = UIController.activeInvoiceId;
    if (!id) return;

    const invIndex = this.invoices.findIndex(item => item.id === id);
    if (invIndex === -1) return;

    const currentInv = this.invoices[invIndex];
    if (!currentInv.previewUrl) {
      UIController.showToast('Không tìm thấy ảnh chứng từ gốc để quét lại', 'error');
      return;
    }

    const apiKey = AIService.getApiKey();
    if (!apiKey) {
      this.openModal('apiSettingsModal');
      UIController.showToast('Vui lòng nhập Google Gemini API Key để quét ảnh thực tế!', 'info');
      return;
    }

    UIController.showToast('Gemini Vision AI đang đọc lại toàn bộ ảnh chứng từ...', 'info');

    try {
      const extracted = await AIService.extractInvoiceFromImage(currentInv.previewUrl, progress => {
        UIController.showToast(progress.message, 'info', 1500);
      });

      // Keep current ID and preview
      extracted.id = currentInv.id;
      extracted.previewUrl = currentInv.previewUrl;
      extracted.fileName = currentInv.fileName;

      this.invoices[invIndex] = extracted;
      this.saveState();
      this.refreshUI();
      UIController.openReviewer(extracted);

      UIController.showToast('Đã quét lại thành công với độ chính xác cao!', 'success');
    } catch (err) {
      UIController.showToast('Lỗi khi quét: ' + err.message, 'error');
    }
  },

  updateAiStatusIndicator() {
    const apiKey = AIService.getApiKey();
    const pill = document.getElementById('aiStatusPill');
    const text = document.getElementById('aiStatusText');
    const dot = pill?.querySelector('.status-dot');

    if (pill && text && dot) {
      if (apiKey) {
        dot.style.background = '#10b981';
        text.innerText = 'Gemini AI Đang Bật';
        pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        pill.title = 'AI Vision thực tế đang hoạt động';
      } else {
        dot.style.background = '#f59e0b';
        text.innerText = 'Chưa nhập API Key';
        pill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        pill.title = 'Nhấn để nhập Google Gemini API Key';
      }
    }
  },

  // Save API Key
  saveGeminiApiKey() {
    const val = document.getElementById('apiKeyInput').value;
    AIService.setApiKey(val);
    this.updateAiStatusIndicator();
    this.closeModal('apiSettingsModal');
    if (val) {
      UIController.showToast('Đã lưu Gemini API Key! Giờ bạn có thể bóc tách ảnh thật bằng Multimodal AI.', 'success');
      // If reviewer is open, ask if user wants to rescan
      if (UIController.activeInvoiceId) {
        this.rescanCurrentInvoice();
      }
    } else {
      UIController.showToast('Đã xóa API Key.', 'info');
    }
  }
};

// Start application when DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
