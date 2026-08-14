/**
 * BILLFLOW AI - DATA EXTRACTION & ACCOUNTING VALIDATION RULES
 * Validates Tax Codes, Math Discrepancies, Currency Normalization & Expense Classification
 */

const ExtractorValidator = {
  // Validate Vietnamese Tax Code (MST - 10 digits or 13 digits: 0101234567-001)
  validateTaxCode(mst) {
    if (!mst) return { isValid: false, message: 'Thiếu mã số thuế' };
    const cleanMST = String(mst).replace(/[^0-9-]/g, '');
    const regex = /^(\d{10}|\d{10}-\d{3}|\d{13})$/;
    const isValid = regex.test(cleanMST);
    return {
      isValid,
      cleanMST,
      message: isValid ? 'Mã số thuế hợp lệ' : 'Định dạng MST chưa chuẩn (cần 10 hoặc 13 số)'
    };
  },

  // Validate arithmetic integrity of invoice
  validateMath(invoice) {
    const subtotal = Number(invoice.subtotal) || 0;
    const vatAmount = Number(invoice.vatAmount) || 0;
    const total = Number(invoice.total) || 0;
    const vatRate = Number(invoice.vatRate) || 0;

    // Check sum of line items
    let lineItemsSum = 0;
    if (Array.isArray(invoice.items) && invoice.items.length > 0) {
      lineItemsSum = invoice.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    }

    const itemSumMatches = lineItemsSum === 0 || Math.abs(lineItemsSum - subtotal) <= 5;
    
    // Check calculated VAT
    const expectedVat = Math.round((subtotal * vatRate) / 100);
    const vatMatches = Math.abs(expectedVat - vatAmount) <= 10 || vatRate === 0;

    // Check Subtotal + VAT = Total
    const totalMatches = Math.abs((subtotal + vatAmount) - total) <= 10;

    const isValid = itemSumMatches && totalMatches;

    return {
      isValid,
      itemSumMatches,
      vatMatches,
      totalMatches,
      difference: total - (subtotal + vatAmount),
      message: isValid 
        ? 'Số liệu khớp 100% (Tiền hàng + VAT = Tổng cộng)' 
        : `Phát hiện sai lệch số học: Chênh lệch ${Math.abs(total - (subtotal + vatAmount)).toLocaleString('vi-VN')} đ`
    };
  },

  // Auto classify expense category based on vendor and items
  classifyCategory(vendorName = '', items = []) {
    const text = `${vendorName} ${items.map(i => i.name || '').join(' ')}`.toLowerCase();

    if (text.includes('xăng') || text.includes('dầu') || text.includes('petrolimex') || text.includes('grab') || text.includes('taxi') || text.includes('be group') || text.includes('vé máy bay') || text.includes('vietnam airlines') || text.includes('vietjet')) {
      return 'Chi phí đi lại / Vận chuyển';
    }
    if (text.includes('nhà hàng') || text.includes('ẩm thực') || text.includes('cổng vàng') || text.includes('golden gate') || text.includes('lẩu') || text.includes('cafe') || text.includes('coffee') || text.includes('tiệc') || text.includes('ăn uống')) {
      return 'Chi phí tiếp khách / Ăn uống';
    }
    if (text.includes('fpt') || text.includes('viettel') || text.includes('vnpt') || text.includes('internet') || text.includes('cước') || text.includes('cloud') || text.includes('server') || text.includes('hosting') || text.includes('tên miền')) {
      return 'Chi phí viễn thông / Internet';
    }
    if (text.includes('phong vũ') || text.includes('máy tính') || text.includes('màn hình') || text.includes('giấy') || text.includes('văn phòng phẩm') || text.includes('chuột') || text.includes('bàn phím') || text.includes('bút') || text.includes('mực in')) {
      return 'Chi phí văn phòng';
    }
    if (text.includes('quảng cáo') || text.includes('facebook') || text.includes('google') || text.includes('tiktok') || text.includes('marketing') || text.includes('in ấn') || text.includes('banner')) {
      return 'Chi phí Marketing / Quảng cáo';
    }
    if (text.includes('thuê nhà') || text.includes('mặt bằng') || text.includes('tòa nhà') || text.includes('văn phòng') || text.includes('điện') || text.includes('nước')) {
      return 'Chi phí mặt bằng & Tiện ích';
    }

    return 'Chi phí quản lý chung';
  },

  // Format currency VND
  formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return '0 đ';
    return Number(val).toLocaleString('vi-VN') + ' đ';
  },

  // Normalize date string into YYYY-MM-DD
  normalizeDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    // If format DD/MM/YYYY
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    return dateStr;
  }
};
