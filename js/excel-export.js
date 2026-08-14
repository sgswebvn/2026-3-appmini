/**
 * BILLFLOW AI - EXCEL (.XLSX) & ACCOUNTING FORMAT EXPORTER
 * Exports 2-Sheet Workbooks (Summary Tax Ledger + Itemized Products) via SheetJS
 * Plus CSV, JSON and Google Sheets 1-Click Clipboard
 */

const ExcelExportService = {
  // Export structured multi-sheet Excel workbook (.xlsx)
  exportToExcel(invoices = [], filename = 'Bang_Ke_Hoa_Don_VAT_BillFlow.xlsx') {
    if (!window.XLSX) {
      alert('Thư viện SheetJS chưa sẵn sàng, vui lòng thử lại sau giây lát!');
      return false;
    }

    // 1. Prepare Sheet 1: Bảng kê tổng hợp hóa đơn đầu vào (Thuế GTGT)
    const summaryData = [
      ['BẢNG KÊ HÓA ĐƠN, CHỨNG TỪ HÀNG HÓA DỊCH VỤ MUA VÀO'],
      ['Kỳ kê khai: Tháng ' + (new Date().getMonth() + 1) + '/' + new Date().getFullYear()],
      ['Ngày xuất file: ' + new Date().toLocaleDateString('vi-VN') + ' | Tạo bởi: BillFlow AI'],
      [], // Empty row
      [
        'STT',
        'Ngày lập HĐ',
        'Ký hiệu HĐ',
        'Số hóa đơn',
        'Tên nhà cung cấp / Người bán',
        'Mã số thuế bên bán',
        'Tiền hàng chưa thuế (VND)',
        'Thuế suất (%)',
        'Tiền thuế GTGT (VND)',
        'Tổng thanh toán (VND)',
        'Phân loại chi phí',
        'Hình thức TT',
        'Trạng thái'
      ]
    ];

    let totalSubtotal = 0;
    let totalVat = 0;
    let grandTotal = 0;

    invoices.forEach((inv, index) => {
      const sub = Number(inv.subtotal) || 0;
      const vat = Number(inv.vatAmount) || 0;
      const tot = Number(inv.total) || 0;

      totalSubtotal += sub;
      totalVat += vat;
      grandTotal += tot;

      summaryData.push([
        index + 1,
        inv.date || '',
        inv.symbol || '',
        inv.invoiceNo || '',
        inv.vendor?.name || '',
        inv.vendor?.taxCode || '',
        sub,
        (Number(inv.vatRate) || 0) + '%',
        vat,
        tot,
        inv.category || 'Quản lý chung',
        inv.paymentMethod || 'Chuyển khoản',
        inv.status === 'verified' ? 'Đã kiểm tra khớp' : 'Cần rà soát'
      ]);
    });

    // Summary Total Row
    summaryData.push([
      'TỔNG CỘNG',
      '',
      '',
      '',
      '',
      '',
      totalSubtotal,
      '',
      totalVat,
      grandTotal,
      '',
      '',
      ''
    ]);

    // 2. Prepare Sheet 2: Chi tiết từng dòng hàng hóa / dịch vụ
    const itemsData = [
      ['BẢNG KÊ CHI TIẾT TỪNG MẶT HÀNG / DỊCH VỤ'],
      ['Ngày xuất file: ' + new Date().toLocaleDateString('vi-VN')],
      [],
      [
        'STT',
        'Số hóa đơn',
        'Ngày HĐ',
        'Tên nhà cung cấp',
        'Tên hàng hóa, dịch vụ',
        'Đơn vị tính',
        'Số lượng',
        'Đơn giá (VND)',
        'Thành tiền (VND)'
      ]
    ];

    let itemStt = 1;
    invoices.forEach(inv => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(item => {
          itemsData.push([
            itemStt++,
            inv.invoiceNo || '',
            inv.date || '',
            inv.vendor?.name || '',
            item.name || '',
            item.unit || '',
            Number(item.quantity) || 1,
            Number(item.price) || 0,
            Number(item.amount) || 0
          ]);
        });
      } else {
        itemsData.push([
          itemStt++,
          inv.invoiceNo || '',
          inv.date || '',
          inv.vendor?.name || '',
          'Toàn bộ dịch vụ theo hóa đơn',
          'Gói',
          1,
          inv.subtotal || 0,
          inv.subtotal || 0
        ]);
      }
    });

    // Create workbook & sheets
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    const wsItems = XLSX.utils.aoa_to_sheet(itemsData);

    // Set custom column widths
    wsSummary['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Ngày
      { wch: 12 }, // Ký hiệu
      { wch: 14 }, // Số HĐ
      { wch: 38 }, // Tên NCC
      { wch: 16 }, // MST
      { wch: 18 }, // Tiền hàng
      { wch: 12 }, // VAT%
      { wch: 16 }, // Tiền VAT
      { wch: 18 }, // Tổng tiền
      { wch: 24 }, // Phân loại
      { wch: 16 }, // TT
      { wch: 16 }  // Trạng thái
    ];

    wsItems['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 36 },
      { wch: 42 },
      { wch: 10 },
      { wch: 10 },
      { wch: 16 },
      { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Bảng Kê Tổng Hợp');
    XLSX.utils.book_append_sheet(wb, wsItems, 'Chi Tiết Mặt Hàng');

    // Trigger file download
    XLSX.writeFile(wb, filename);
    return true;
  },

  // Export clean CSV with UTF-8 BOM
  exportToCsv(invoices = [], filename = 'Hoa_Don_BillFlow.csv') {
    const headers = ['STT', 'Ngày HĐ', 'Số HĐ', 'Ký hiệu', 'Tên bên bán', 'MST bên bán', 'Tiền hàng', 'Thuế VAT', 'Tổng thanh toán', 'Phân loại'];
    const rows = invoices.map((inv, idx) => [
      idx + 1,
      inv.date,
      `"${inv.invoiceNo}"`,
      `"${inv.symbol || ''}"`,
      `"${(inv.vendor?.name || '').replace(/"/g, '""')}"`,
      `"${inv.vendor?.taxCode || ''}"`,
      inv.subtotal,
      inv.vatAmount,
      inv.total,
      `"${inv.category || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Export JSON
  exportToJson(invoices = [], filename = 'Hoa_Don_BillFlow.json') {
    const dataStr = JSON.stringify(invoices, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Copy Tab-Delimited text to clipboard ready for Google Sheets paste (Ctrl + V)
  copyForGoogleSheets(invoices = []) {
    const rows = invoices.map((inv, idx) => [
      idx + 1,
      inv.date || '',
      inv.invoiceNo || '',
      inv.vendor?.name || '',
      inv.vendor?.taxCode || '',
      inv.subtotal || 0,
      inv.vatRate || 0,
      inv.vatAmount || 0,
      inv.total || 0,
      inv.category || 'Chi phí chung'
    ].join('\t'));

    const header = ['STT', 'Ngày HĐ', 'Số HĐ', 'Tên bên bán', 'MST', 'Tiền hàng', 'Thuế %', 'Tiền thuế', 'Tổng thanh toán', 'Phân loại'].join('\t');
    const fullText = header + '\n' + rows.join('\n');

    return navigator.clipboard.writeText(fullText);
  }
};
