const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unit: { type: String, default: 'Cái' },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: { type: String, default: 'Hóa đơn GTGT' },
  invoiceNo: { type: String, default: '' },
  symbol: { type: String, default: '' },
  date: { type: String, default: '' },
  category: { type: String, default: 'Văn phòng phẩm' },
  paymentMethod: { type: String, default: 'Chuyển khoản' },
  vendor: {
    name: { type: String, default: '' },
    taxCode: { type: String, default: '' },
    address: { type: String, default: '' }
  },
  buyer: {
    name: { type: String, default: '' },
    taxCode: { type: String, default: '' }
  },
  items: [invoiceItemSchema],
  subtotal: { type: Number, default: 0 },
  vatRate: { type: Number, default: 10 },
  vatAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, enum: ['verified', 'warning', 'pending'], default: 'verified' },
  previewUrl: { type: String, default: '' },
  fileName: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
