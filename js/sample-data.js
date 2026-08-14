/**
 * BILLFLOW AI - SAMPLE INVOICE DATA & SVG GENERATOR
 * Provides authentic Vietnamese invoice samples (VAT GTGT, Grab, Petrolimex, FPT Telecom, Restaurant)
 */

const SampleDataService = {
  // Generate realistic SVG invoice mockups for instant preview
  generateInvoiceSvg(sample) {
    const { title, invoiceNo, date, vendor, buyer, items, subtotal, vatRate, vatAmount, total, templateColor } = sample;
    const color = templateColor || '#10b981';

    const itemsRows = items.map((item, idx) => `
      <tr style="border-bottom: 1px dashed #cbd5e1; font-size: 11px;">
        <td style="padding: 6px 4px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 4px;"><strong>${item.name}</strong></td>
        <td style="padding: 6px 4px; text-align: center;">${item.unit}</td>
        <td style="padding: 6px 4px; text-align: right;">${item.quantity}</td>
        <td style="padding: 6px 4px; text-align: right;">${item.price.toLocaleString('vi-VN')} đ</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold;">${item.amount.toLocaleString('vi-VN')} đ</td>
      </tr>
    `).join('');

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b;">
        <rect width="600" height="800" fill="#ffffff" />
        
        <!-- Header Banner -->
        <rect width="600" height="12" fill="${color}" />
        <rect x="30" y="30" width="8" height="50" fill="${color}" rx="4" />
        
        <text x="50" y="52" font-size="18" font-weight="bold" fill="#0f172a">${vendor.name.toUpperCase()}</text>
        <text x="50" y="70" font-size="11" fill="#64748b">MST: ${vendor.taxCode} | ĐT: ${vendor.phone || '028.7300.8888'}</text>
        <text x="50" y="85" font-size="10" fill="#64748b">Đ/C: ${vendor.address}</text>

        <!-- Invoice Title -->
        <line x1="30" y1="105" x2="570" y2="105" stroke="#e2e8f0" stroke-width="1.5" />
        
        <text x="300" y="135" font-size="17" font-weight="bold" fill="#0f172a" text-anchor="middle">${title.toUpperCase()}</text>
        <text x="300" y="152" font-size="11" fill="#64748b" text-anchor="middle">Ký hiệu: 1C24TLL | Số: ${invoiceNo} | Ngày: ${date}</text>

        <!-- Buyer Info Box -->
        <rect x="30" y="170" width="540" height="75" fill="#f8fafc" stroke="#e2e8f0" rx="6" />
        <text x="45" y="190" font-size="11" font-weight="bold" fill="#334155">Đơn vị mua hàng:</text>
        <text x="145" y="190" font-size="11" fill="#0f172a">${buyer.name}</text>
        <text x="45" y="210" font-size="11" font-weight="bold" fill="#334155">Mã số thuế:</text>
        <text x="145" y="210" font-size="11" font-weight="bold" fill="#0f172a">${buyer.taxCode}</text>
        <text x="45" y="230" font-size="11" font-weight="bold" fill="#334155">Địa chỉ:</text>
        <text x="145" y="230" font-size="10" fill="#64748b">${buyer.address}</text>

        <!-- Line Items Table -->
        <foreignObject x="30" y="260" width="540" height="340">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif;">
              <thead>
                <tr style="background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px 4px; text-align: center; width: 30px;">STT</th>
                  <th style="padding: 8px 4px; text-align: left;">Tên hàng hóa, dịch vụ</th>
                  <th style="padding: 8px 4px; text-align: center; width: 45px;">ĐVT</th>
                  <th style="padding: 8px 4px; text-align: right; width: 45px;">SL</th>
                  <th style="padding: 8px 4px; text-align: right; width: 85px;">Đơn giá</th>
                  <th style="padding: 8px 4px; text-align: right; width: 95px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>
        </foreignObject>

        <!-- Total Breakdown Box -->
        <rect x="300" y="605" width="270" height="105" fill="#f8fafc" stroke="#cbd5e1" rx="6" />
        
        <text x="315" y="628" font-size="11" fill="#64748b">Cộng tiền hàng:</text>
        <text x="555" y="628" font-size="11" font-weight="600" text-anchor="end" fill="#0f172a">${subtotal.toLocaleString('vi-VN')} đ</text>

        <text x="315" y="650" font-size="11" fill="#64748b">Thuế suất GTGT (${vatRate}%):</text>
        <text x="555" y="650" font-size="11" font-weight="600" text-anchor="end" fill="#0f172a">${vatAmount.toLocaleString('vi-VN')} đ</text>

        <line x1="315" y1="662" x2="555" y2="662" stroke="#cbd5e1" />

        <text x="315" y="688" font-size="13" font-weight="bold" fill="#0f172a">TỔNG CỘNG:</text>
        <text x="555" y="688" font-size="14" font-weight="bold" text-anchor="end" fill="${color}">${total.toLocaleString('vi-VN')} đ</text>

        <!-- Digital Signature Seal -->
        <circle cx="120" cy="690" r="35" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 2" />
        <text x="120" y="685" font-size="9" font-weight="bold" fill="#ef4444" text-anchor="middle">ĐÃ KÝ ĐIỆN TỬ</text>
        <text x="120" y="698" font-size="8" fill="#ef4444" text-anchor="middle">HỢP LỆ VÀ BẢO MẬT</text>
        <text x="120" y="710" font-size="7" fill="#ef4444" text-anchor="middle">${date}</text>

        <!-- Footer Note -->
        <text x="300" y="775" font-size="9" fill="#94a3b8" text-anchor="middle">Tra cứu hóa đơn điện tử tại: https://tracuu.hoadon.gov.vn | Mã CQT: 00E1C9283F</text>
      </svg>
    `;

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  },

  getSamples() {
    const rawSamples = [
      {
        id: 'sample_01',
        title: 'Hóa đơn Giá trị Gia tăng (Điện tử)',
        invoiceNo: '0004921',
        symbol: '1C24TLL',
        date: '2026-08-10',
        category: 'Chi phí văn phòng',
        vendor: {
          name: 'CÔNG TY CP THƯƠNG MẠI DỊCH VỤ PHONG VŨ',
          taxCode: '0304998365',
          address: '264 Nguyễn Thị Minh Khai, P. Võ Thị Sáu, Q.3, TP.HCM',
          phone: '18006867'
        },
        buyer: {
          name: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG DIGITAL NEXT',
          taxCode: '0108849201',
          address: 'Tầng 5, Tòa nhà Innovation, Cầu Giấy, Hà Nội'
        },
        items: [
          { name: 'Màn hình Dell UltraSharp U2723QE 27 inch 4K', unit: 'Cái', quantity: 2, price: 11500000, amount: 23000000 },
          { name: 'Bàn phím cơ không dây Keychron Q1 Pro', unit: 'Cái', quantity: 3, price: 3850000, amount: 11550000 },
          { name: 'Chuột công thái học Logitech MX Master 3S', unit: 'Cái', quantity: 3, price: 2190000, amount: 6570000 }
        ],
        subtotal: 41120000,
        vatRate: 10,
        vatAmount: 4112000,
        total: 45232000,
        paymentMethod: 'Chuyển khoản',
        status: 'verified',
        templateColor: '#2563eb'
      },
      {
        id: 'sample_02',
        title: 'Hóa đơn dịch vụ Viễn thông & Internet',
        invoiceNo: '0098412',
        symbol: '1C24FPT',
        date: '2026-08-05',
        category: 'Chi phí viễn thông / Internet',
        vendor: {
          name: 'CÔNG TY CỔ PHẦN VIỄN THÔNG FPT (FPT TELECOM)',
          taxCode: '0101778163',
          address: 'Tòa nhà FPT, Phố Duy Tân, P. Dịch Vọng Hậu, Q. Cầu Giấy, Hà Nội',
          phone: '19006600'
        },
        buyer: {
          name: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG DIGITAL NEXT',
          taxCode: '0108849201',
          address: 'Tầng 5, Tòa nhà Innovation, Cầu Giấy, Hà Nội'
        },
        items: [
          { name: 'Cước Internet Doanh nghiệp Gói Super Lux 800 (08/2026)', unit: 'Tháng', quantity: 1, price: 1800000, amount: 1800000 },
          { name: 'Dịch vụ IP Tĩnh (Static IP)', unit: 'Tháng', quantity: 1, price: 500000, amount: 500000 },
          { name: 'Dịch vụ Cloud Backup 1TB', unit: 'Gói', quantity: 1, price: 450000, amount: 450000 }
        ],
        subtotal: 2750000,
        vatRate: 10,
        vatAmount: 275000,
        total: 3025000,
        paymentMethod: 'Ủy nhiệm chi / Chuyển khoản',
        status: 'verified',
        templateColor: '#ea580c'
      },
      {
        id: 'sample_03',
        title: 'Hóa đơn Xăng dầu & Nhiên liệu',
        invoiceNo: '0129481',
        symbol: '1C24PLX',
        date: '2026-08-12',
        category: 'Chi phí đi lại / Vận chuyển',
        vendor: {
          name: 'TẬP ĐOÀN XĂNG DẦU VIỆT NAM (PETROLIMEX)',
          taxCode: '0100107624',
          address: 'Số 1 Khâm Thiên, P. Khâm Thiên, Q. Đống Đa, Hà Nội',
          phone: '024.3851.2603'
        },
        buyer: {
          name: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG DIGITAL NEXT',
          taxCode: '0108849201',
          address: 'Tầng 5, Tòa nhà Innovation, Cầu Giấy, Hà Nội'
        },
        items: [
          { name: 'Xăng RON 95-V (Cung cấp cho xe công tác 30E-921.84)', unit: 'Lít', quantity: 65.5, price: 22850, amount: 1496675 }
        ],
        subtotal: 1496675,
        vatRate: 8,
        vatAmount: 119734,
        total: 1616409,
        paymentMethod: 'Thẻ Doanh nghiệp',
        status: 'verified',
        templateColor: '#059669'
      },
      {
        id: 'sample_04',
        title: 'Hóa đơn Tiếp khách & Ẩm thực',
        invoiceNo: '0038104',
        symbol: '1C24GGG',
        date: '2026-08-11',
        category: 'Chi phí tiếp khách / Ăn uống',
        vendor: {
          name: 'CÔNG TY CP THƯƠNG MẠI DỊCH VỤ CỔNG VÀNG (GOLDEN GATE)',
          taxCode: '0102721191',
          address: 'Số 60 Phố Giang Văn Minh, P. Đội Cấn, Q. Ba Đình, Hà Nội',
          phone: '19006622'
        },
        buyer: {
          name: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG DIGITAL NEXT',
          taxCode: '0108849201',
          address: 'Tầng 5, Tòa nhà Innovation, Cầu Giấy, Hà Nội'
        },
        items: [
          { name: 'Set Lẩu Nấm Thiên Nhiên Thượng Hạng', unit: 'Set', quantity: 2, price: 1650000, amount: 3300000 },
          { name: 'Bò Wagyu A5 Nhật Bản Thượng Hạng', unit: 'Phần', quantity: 3, price: 980000, amount: 2940000 },
          { name: 'Nước suối khoáng & Trà thảo mộc', unit: 'Bình', quantity: 4, price: 95000, amount: 380000 }
        ],
        subtotal: 6620000,
        vatRate: 8,
        vatAmount: 529600,
        total: 7149600,
        paymentMethod: 'Quẹt thẻ POS',
        status: 'verified',
        templateColor: '#b91c1c'
      }
    ];

    // Attach generated SVG preview image data URLs
    return rawSamples.map(sample => ({
      ...sample,
      previewUrl: this.generateInvoiceSvg(sample),
      fileName: `${sample.invoiceNo}_${sample.vendor.taxCode}.png`,
      fileSize: '428 KB',
      processedAt: new Date().toISOString()
    }));
  }
};
