/**
 * BILLFLOW AI - UI CONTROLLER & VIEW RENDERER
 * Handles Split-Screen Reviewer, Data Grid, Chart.js Analytics, Pan/Zoom & Toasts
 */

const UIController = {
  activeInvoiceId: null,
  zoomLevel: 1,
  rotationDegree: 0,
  isDraggingImage: false,
  dragStartX: 0,
  dragStartY: 0,
  panX: 0,
  panY: 0,
  chartInstanceCategory: null,
  chartInstanceVendor: null,

  // Toast notification manager
  showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    let icon = 'lucide-check-circle-2';
    if (type === 'error') icon = 'lucide-alert-triangle';
    if (type === 'info') icon = 'lucide-info';

    toast.innerHTML = `
      <i data-lucide="${icon}" style="width: 18px; height: 18px; color: ${type === 'error' ? '#ef4444' : type === 'info' ? '#3b82f6' : '#10b981'};"></i>
      <span style="font-size: 0.85rem; font-weight: 500;">${message}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Update Top Stats Ribbon
  updateStatsRibbon(invoices = []) {
    const totalCount = invoices.length;
    let totalSpending = 0;
    let totalVat = 0;
    let warningCount = 0;

    invoices.forEach(inv => {
      totalSpending += Number(inv.total) || 0;
      totalVat += Number(inv.vatAmount) || 0;
      if (inv.status === 'warning') warningCount++;
    });

    document.getElementById('statTotalCount').innerText = totalCount;
    document.getElementById('statTotalSpending').innerText = ExtractorValidator.formatCurrency(totalSpending);
    document.getElementById('statTotalVat').innerText = ExtractorValidator.formatCurrency(totalVat);
    document.getElementById('statWarningCount').innerText = warningCount;

    // Update Database Storage Indicator
    const quotaFill = document.getElementById('quotaFill');
    const quotaText = document.getElementById('quotaText');
    if (quotaFill) quotaFill.style.width = '100%';
    if (quotaText) quotaText.innerText = `${totalCount} Chứng từ trong cơ sở dữ liệu MongoDB`;
  },

  // Render Data Grid Table
  renderDataGrid(invoices = [], searchTerm = '', categoryFilter = 'all') {
    const tbody = document.getElementById('invoiceTableBody');
    if (!tbody) return;

    // Filter data
    const filtered = invoices.filter(inv => {
      const matchSearch = !searchTerm || 
        (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.vendor?.name && inv.vendor.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (inv.vendor?.taxCode && inv.vendor.taxCode.includes(searchTerm));
      
      const matchCategory = categoryFilter === 'all' || inv.category === categoryFilter;
      return matchSearch && matchCategory;
    });

    document.getElementById('gridCountLabel').innerText = `Hiển thị ${filtered.length}/${invoices.length} hóa đơn`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 3.5rem 1rem; color: var(--text-muted);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                <i data-lucide="inbox" style="width: 28px; height: 28px;"></i>
              </div>
              <p style="font-size: 1.05rem; font-weight: 700; color: #f8fafc;">Chưa có chứng từ nào trong cơ sở dữ liệu</p>
              <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 480px;">
                Kéo thả ảnh hóa đơn VAT, bill thanh toán hoặc phiếu chi vào khung bên trên để AI tự động bóc tách sang Excel trong 2 giây.
              </p>
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = filtered.map((inv, idx) => {
      const isVerified = inv.status === 'verified';
      const categoryClass = (inv.category || '').includes('tiếp khách') || (inv.category || '').includes('ăn uống') ? 'food' :
        (inv.category || '').includes('vận chuyển') || (inv.category || '').includes('đi lại') ? 'transport' : 'office';

      const itemsCount = (inv.items && inv.items.length) || 0;

      // Nested sub-rows for all products
      const itemsSubTable = (inv.items && inv.items.length > 0) ? `
        <tr id="expand_row_${inv.id}" style="display: none; background: rgba(15, 23, 42, 0.95);">
          <td colspan="11" style="padding: 1rem 1.5rem; border-left: 3px solid var(--primary);">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
              <span><i data-lucide="package" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> Chi tiết ${itemsCount} mặt hàng trong hóa đơn #${inv.invoiceNo || '---'}:</span>
              <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="App.openReviewer('${inv.id}')">
                <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Mở sửa chi tiết
              </button>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; background: rgba(0,0,0,0.25); border-radius: var(--radius-sm); overflow: hidden;">
              <thead>
                <tr style="background: rgba(255,255,255,0.06); color: var(--text-muted); text-transform: uppercase; font-size: 0.7rem;">
                  <th style="padding: 6px 10px; width: 35px; text-align: center;">STT</th>
                  <th style="padding: 6px 10px; text-align: left;">Tên hàng hóa, dịch vụ</th>
                  <th style="padding: 6px 10px; width: 55px; text-align: center;">ĐVT</th>
                  <th style="padding: 6px 10px; width: 60px; text-align: right;">SL</th>
                  <th style="padding: 6px 10px; width: 110px; text-align: right;">Đơn giá</th>
                  <th style="padding: 6px 10px; width: 120px; text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map((it, i) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 6px 10px; text-align: center; color: var(--text-muted);">${i + 1}</td>
                    <td style="padding: 6px 10px; font-weight: 600; color: #f8fafc;">${it.name || '---'}</td>
                    <td style="padding: 6px 10px; text-align: center; color: var(--text-secondary);">${it.unit || 'Cái'}</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: var(--font-mono); font-weight: 600;">${it.quantity || 1}</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: var(--font-mono); color: var(--text-secondary);">${ExtractorValidator.formatCurrency(it.price)}</td>
                    <td style="padding: 6px 10px; text-align: right; font-family: var(--font-mono); font-weight: 700; color: var(--primary);">${ExtractorValidator.formatCurrency(it.amount)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </td>
        </tr>
      ` : '';

      return `
        <tr data-id="${inv.id}" class="${inv.id === this.activeInvoiceId ? 'selected' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" class="row-checkbox" value="${inv.id}">
          </td>
          <td>
            <div style="font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.4rem;">
              <span>${inv.invoiceNo || '---'}</span>
              ${itemsCount > 0 ? `
              <button class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem; border-radius: 4px;" onclick="UIController.toggleRowExpand('${inv.id}')" title="Bấm để xem nhanh tất cả sản phẩm">
                <i data-lucide="chevron-down" id="chevron_${inv.id}" style="width: 12px; height: 12px; transition: transform 0.2s;"></i> ${itemsCount} món
              </button>` : ''}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${inv.symbol || '1C26TAV'}</div>
          </td>
          <td style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-secondary);">${inv.date || '---'}</td>
          <td style="max-width: 260px;">
            <div style="font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${inv.vendor?.name || ''}">
              ${inv.vendor?.name || 'Chưa nhận diện'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${inv.vendor?.address || ''}
            </div>
          </td>
          <td style="font-family: var(--font-mono); color: var(--primary); font-weight: 600; font-size: 0.85rem;">
            ${inv.vendor?.taxCode || '---'}
          </td>
          <td>
            <span class="category-pill ${categoryClass}">${inv.category || 'Quản lý chung'}</span>
          </td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 600;">
            ${ExtractorValidator.formatCurrency(inv.subtotal)}
          </td>
          <td style="text-align: right; font-family: var(--font-mono); color: var(--text-secondary);">
            ${ExtractorValidator.formatCurrency(inv.vatAmount)}
            <span style="font-size: 0.7rem; color: var(--text-muted);">(${inv.vatRate || 0}%)</span>
          </td>
          <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: var(--primary); font-size: 0.95rem;">
            ${ExtractorValidator.formatCurrency(inv.total)}
          </td>
          <td style="text-align: center;">
            <span class="status-badge ${isVerified ? 'verified' : 'warning'}">
              <i data-lucide="${isVerified ? 'check-circle' : 'alert-triangle'}" style="width: 12px; height: 12px;"></i>
              ${isVerified ? 'Hợp lệ' : 'Cần rà soát'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem;">
              <button class="btn btn-primary btn-sm" onclick="App.openReviewer('${inv.id}')" title="So sánh & Chỉnh sửa chi tiết">
                <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Xem & Sửa
              </button>
              <button class="btn btn-secondary btn-sm" style="color: #ef4444; padding: 0.35rem;" onclick="App.deleteInvoice('${inv.id}')" title="Xóa">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </td>
        </tr>
        ${itemsSubTable}
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  toggleRowExpand(id) {
    const row = document.getElementById(`expand_row_${id}`);
    const chevron = document.getElementById(`chevron_${id}`);
    if (row) {
      const isHidden = row.style.display === 'none';
      row.style.display = isHidden ? 'table-row' : 'none';
      if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  },

  // Open Split-Screen Reviewer
  openReviewer(invoice) {
    if (!invoice) return;
    this.activeInvoiceId = invoice.id || invoice._id;
    this.zoomLevel = 1;
    this.rotationDegree = 0;
    this.panX = 0;
    this.panY = 0;

    const card = document.getElementById('reviewerCard');
    if (card) {
      card.classList.add('open');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 1. Render Left Pane (Document Viewport)
    const imgPreview = document.getElementById('docPreviewImage');
    const placeholder = document.getElementById('docPlaceholderMessage');
    
    if (invoice.previewUrl) {
      if (imgPreview) {
        imgPreview.src = invoice.previewUrl;
        imgPreview.style.display = 'block';
        imgPreview.style.transform = `scale(1) rotate(0deg) translate(0px, 0px)`;
      }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (imgPreview) {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
      }
      if (placeholder) placeholder.style.display = 'block';
    }

    const zoomEl = document.getElementById('zoomPercentage');
    if (zoomEl) zoomEl.innerText = '100%';

    // 2. Render Right Pane (Form inputs)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = (val !== undefined && val !== null) ? val : '';
    };

    setVal('revTitle', invoice.title || 'Hóa đơn GTGT');
    setVal('revInvoiceNo', invoice.invoiceNo || '');
    setVal('revSymbol', invoice.symbol || '');
    setVal('revDate', invoice.date || '');
    setVal('revCategory', invoice.category || 'Văn phòng phẩm');
    setVal('revPaymentMethod', invoice.paymentMethod || 'Chuyển khoản');

    // Vendor info
    setVal('revVendorName', invoice.vendor?.name || '');
    setVal('revVendorTaxCode', invoice.vendor?.taxCode || '');
    setVal('revVendorAddress', invoice.vendor?.address || '');

    // Buyer info
    setVal('revBuyerName', invoice.buyer?.name || '');
    setVal('revBuyerTaxCode', invoice.buyer?.taxCode || '');

    // Line items table
    this.renderReviewerItems(invoice.items || []);

    // Summary calculations
    setVal('revSubtotal', invoice.subtotal || 0);
    setVal('revVatRate', invoice.vatRate !== undefined ? invoice.vatRate : 10);
    setVal('revVatAmount', invoice.vatAmount || 0);
    setVal('revTotal', invoice.total || 0);

    this.checkMathInReviewer();
    if (window.lucide) lucide.createIcons();
  },

  // Toggle Fullscreen Mode for Reviewer
  toggleReviewerFullscreen() {
    const card = document.getElementById('reviewerCard');
    if (!card) return;
    const isFs = card.classList.toggle('fullscreen');
    const icon = document.getElementById('fsIcon');
    const text = document.getElementById('fsText');

    if (isFs) {
      if (text) text.innerText = 'Thu nhỏ giao diện';
      if (icon) icon.setAttribute('data-lucide', 'minimize-2');
      document.body.style.overflow = 'hidden';
    } else {
      if (text) text.innerText = 'Mở rộng toàn màn hình';
      if (icon) icon.setAttribute('data-lucide', 'maximize-2');
      document.body.style.overflow = '';
    }
    if (window.lucide) lucide.createIcons();
  },

  // Close Reviewer
  closeReviewer() {
    const card = document.getElementById('reviewerCard');
    if (card) {
      card.classList.remove('open');
      card.classList.remove('fullscreen');
    }
    document.body.style.overflow = '';
    const text = document.getElementById('fsText');
    if (text) text.innerText = 'Mở rộng toàn màn hình';
    this.activeInvoiceId = null;
  },

  // Render Line items inside Reviewer
  renderReviewerItems(items = []) {
    const tbody = document.getElementById('revItemsTableBody');
    const badge = document.getElementById('revItemCountBadge');
    if (badge) badge.innerText = `${items.length} món`;
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
            Chưa có dòng hàng hóa nào. Nhấn nút "+ Thêm dòng" ở trên để thêm.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map((item, index) => `
      <tr data-index="${index}">
        <td style="text-align: center; color: var(--text-muted); font-size: 0.75rem; font-family: var(--font-mono);">${index + 1}</td>
        <td><input type="text" class="item-name" value="${item.name || ''}" placeholder="Tên hàng hóa, dịch vụ..." oninput="UIController.onItemChange()"></td>
        <td style="width: 70px;"><input type="text" class="item-unit" style="text-align: center;" value="${item.unit || 'Cái'}" placeholder="ĐVT" oninput="UIController.onItemChange()"></td>
        <td style="width: 70px;"><input type="number" class="item-qty" style="text-align: right;" value="${item.quantity || 1}" min="0.01" step="any" oninput="UIController.onItemChange()"></td>
        <td style="width: 110px;"><input type="number" class="item-price" style="text-align: right;" value="${item.price || 0}" step="1000" oninput="UIController.onItemChange()"></td>
        <td style="width: 120px;"><input type="number" class="item-amount" style="text-align: right;" value="${item.amount || 0}" readonly></td>
        <td style="text-align: center; width: 34px;">
          <button type="button" class="btn btn-secondary btn-sm btn-icon-only" style="color: #ef4444;" onclick="UIController.removeLineItem(${index})" title="Xóa dòng">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </td>
      </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  // Recalculate line items on edit
  onItemChange() {
    const rows = document.querySelectorAll('#revItemsTableBody tr');
    let calculatedSubtotal = 0;
    let count = 0;

    rows.forEach(row => {
      const qtyInput = row.querySelector('.item-qty');
      const priceInput = row.querySelector('.item-price');
      const amountInput = row.querySelector('.item-amount');

      if (qtyInput && priceInput && amountInput) {
        count++;
        const qty = parseFloat(qtyInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const amount = Math.round(qty * price);
        amountInput.value = amount;
        calculatedSubtotal += amount;
      }
    });

    const badge = document.getElementById('revItemCountBadge');
    if (badge) badge.innerText = `${count} món`;

    if (calculatedSubtotal >= 0) {
      document.getElementById('revSubtotal').value = calculatedSubtotal;
      this.recalculateTaxAndTotal();
    }
  },

  // Add new empty line item
  addLineItem() {
    const tbody = document.getElementById('revItemsTableBody');
    if (!tbody) return;
    const index = tbody.querySelectorAll('tr').length;
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    tr.innerHTML = `
      <td style="text-align: center; color: var(--text-muted); font-size: 0.75rem; font-family: var(--font-mono);">${index + 1}</td>
      <td><input type="text" class="item-name" value="" placeholder="Tên hàng hóa mới..." oninput="UIController.onItemChange()"></td>
      <td style="width: 70px;"><input type="text" class="item-unit" style="text-align: center;" value="Cái" oninput="UIController.onItemChange()"></td>
      <td style="width: 70px;"><input type="number" class="item-qty" style="text-align: right;" value="1" oninput="UIController.onItemChange()"></td>
      <td style="width: 110px;"><input type="number" class="item-price" style="text-align: right;" value="0" oninput="UIController.onItemChange()"></td>
      <td style="width: 120px;"><input type="number" class="item-amount" style="text-align: right;" value="0" readonly></td>
      <td style="text-align: center; width: 34px;">
        <button type="button" class="btn btn-secondary btn-sm btn-icon-only" style="color: #ef4444;" onclick="this.closest('tr').remove(); UIController.onItemChange();" title="Xóa dòng">
          <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
    this.onItemChange();
    if (window.lucide) lucide.createIcons();
  },

  addReviewerItemRow() {
    this.addLineItem();
  },

  removeLineItem(index) {
    const row = document.querySelector(`#revItemsTableBody tr[data-index="${index}"]`);
    if (row) {
      row.remove();
      this.onItemChange();
    }
  },

  // Recalculate VAT Amount & Total
  recalculateTaxAndTotal() {
    const subtotal = Number(document.getElementById('revSubtotal')?.value) || 0;
    const vatRate = Number(document.getElementById('revVatRate')?.value) || 0;
    const vatAmount = Math.round((subtotal * vatRate) / 100);
    const vatEl = document.getElementById('revVatAmount');
    const totalEl = document.getElementById('revTotal');
    if (vatEl) vatEl.value = vatAmount;
    if (totalEl) totalEl.value = subtotal + vatAmount;
    this.checkMathInReviewer();
  },

  calcReviewerTotals() {
    this.recalculateTaxAndTotal();
  },

  // Live Math Check Alert inside Reviewer
  checkMathInReviewer() {
    const box = document.getElementById('revMathAlert');
    if (!box) return;

    const subtotal = Number(document.getElementById('revSubtotal')?.value) || 0;
    const vatAmount = Number(document.getElementById('revVatAmount')?.value) || 0;
    const total = Number(document.getElementById('revTotal')?.value) || 0;

    const expected = subtotal + vatAmount;
    const diff = Math.abs(expected - total);

    if (diff <= 5) {
      box.className = 'math-validation-box valid';
      box.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="shield-check" style="width: 18px; height: 18px; color: #10b981;"></i>
          <span>Số liệu khớp hoàn hảo: ${subtotal.toLocaleString('vi-VN')} + ${vatAmount.toLocaleString('vi-VN')} = ${total.toLocaleString('vi-VN')} đ</span>
        </div>
        <span style="font-size: 0.7rem; background: rgba(16,185,129,0.2); color: #10b981; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700;">Khớp 100%</span>
      `;
    } else {
      box.className = 'math-validation-box invalid';
      box.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="alert-circle" style="width: 18px; height: 18px; color: #ef4444;"></i>
          <span>Cảnh báo lệch số học: Tiền hàng + VAT (${expected.toLocaleString('vi-VN')} đ) khác Tổng tiền (${total.toLocaleString('vi-VN')} đ)</span>
        </div>
        <span style="font-size: 0.7rem; background: rgba(239,68,68,0.2); color: #ef4444; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 700;">Lệch ${diff.toLocaleString('vi-VN')} đ</span>
      `;
    }
    if (window.lucide) lucide.createIcons();
  },

  // Document Pan / Zoom / Rotate handlers
  zoomDoc(delta) {
    this.zoomLevel = Math.max(0.4, Math.min(3.5, this.zoomLevel + delta));
    this.applyDocTransform();
  },

  rotateDoc() {
    this.rotationDegree = (this.rotationDegree + 90) % 360;
    this.applyDocTransform();
  },

  resetDocTransform() {
    this.zoomLevel = 1;
    this.rotationDegree = 0;
    this.panX = 0;
    this.panY = 0;
    this.applyDocTransform();
  },

  resetDocView() {
    this.resetDocTransform();
  },

  applyDocTransform() {
    const img = document.getElementById('docPreviewImage');
    if (img) {
      img.style.transform = `scale(${this.zoomLevel}) rotate(${this.rotationDegree}deg) translate(${this.panX}px, ${this.panY}px)`;
    }
    const zoomEl = document.getElementById('zoomPercentage');
    if (zoomEl) {
      zoomEl.innerText = `${Math.round(this.zoomLevel * 100)}%`;
    }
  },

  // Render Chart.js Analytics Modal
  renderAnalytics(invoices = []) {
    if (!window.Chart) return;

    // 1. Categories Aggregation
    const categoryTotals = {};
    const vendorTotals = {};

    invoices.forEach(inv => {
      const cat = inv.category || 'Chi phí khác';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(inv.total) || 0);

      const vendor = inv.vendor?.name ? (inv.vendor.name.length > 25 ? inv.vendor.name.substring(0, 25) + '...' : inv.vendor.name) : 'Khác';
      vendorTotals[vendor] = (vendorTotals[vendor] || 0) + (Number(inv.total) || 0);
    });

    const catLabels = Object.keys(categoryTotals);
    const catValues = Object.values(categoryTotals);

    const vendorLabels = Object.keys(vendorTotals).slice(0, 5);
    const vendorValues = Object.values(vendorTotals).slice(0, 5);

    // Render Category Chart
    const ctxCat = document.getElementById('categoryChartCanvas');
    if (ctxCat) {
      if (this.chartInstanceCategory) this.chartInstanceCategory.destroy();
      this.chartInstanceCategory = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: catValues,
            backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
          }
        }
      });
    }

    // Render Top Vendors Bar Chart
    const ctxVen = document.getElementById('vendorChartCanvas');
    if (ctxVen) {
      if (this.chartInstanceVendor) this.chartInstanceVendor.destroy();
      this.chartInstanceVendor = new Chart(ctxVen, {
        type: 'bar',
        data: {
          labels: vendorLabels,
          datasets: [{
            label: 'Tổng tiền (VND)',
            data: vendorValues,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
          }
        }
      });
    }
  },

  // Render Master All Items Modal
  renderAllItemsModal(invoices = [], keyword = '') {
    const tbody = document.getElementById('allItemsMasterTableBody');
    const badge = document.getElementById('allItemsCountBadge');
    if (!tbody) return;

    // Collect all items across all invoices
    const allItems = [];
    invoices.forEach(inv => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(it => {
          allItems.push({
            invoiceNo: inv.invoiceNo || '---',
            date: inv.date || '---',
            vendorName: inv.vendor?.name || '---',
            name: it.name || '---',
            unit: it.unit || 'Cái',
            quantity: it.quantity || 1,
            price: it.price || 0,
            amount: it.amount || 0
          });
        });
      }
    });

    const filtered = allItems.filter(it => {
      if (!keyword) return true;
      const kw = keyword.toLowerCase();
      return it.name.toLowerCase().includes(kw) ||
        it.invoiceNo.toLowerCase().includes(kw) ||
        it.vendorName.toLowerCase().includes(kw);
    });

    if (badge) badge.innerText = `Tổng cộng: ${filtered.length} mặt hàng`;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Không tìm thấy sản phẩm nào phù hợp từ khóa.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((it, idx) => `
      <tr>
        <td style="text-align: center; font-family: var(--font-mono); color: var(--text-muted);">${idx + 1}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #f8fafc;">${it.invoiceNo}</td>
        <td style="font-family: var(--font-mono); color: var(--text-secondary);">${it.date}</td>
        <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${it.vendorName}">${it.vendorName}</td>
        <td style="font-weight: 600; color: #f8fafc;">${it.name}</td>
        <td style="text-align: center; color: var(--text-secondary);">${it.unit}</td>
        <td style="text-align: right; font-family: var(--font-mono); font-weight: 600;">${it.quantity}</td>
        <td style="text-align: right; font-family: var(--font-mono); color: var(--text-secondary);">${ExtractorValidator.formatCurrency(it.price)}</td>
        <td style="text-align: right; font-family: var(--font-mono); font-weight: 800; color: var(--primary);">${ExtractorValidator.formatCurrency(it.amount)}</td>
      </tr>
    `).join('');
  },

  filterAllItemsModal() {
    const kw = document.getElementById('itemSearchInput')?.value || '';
    if (window.App && window.App.invoices) {
      this.renderAllItemsModal(window.App.invoices, kw);
    }
  }
};
