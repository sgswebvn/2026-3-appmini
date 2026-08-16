const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const { authMiddleware } = require('../middleware/auth');

// All invoice routes require valid authentication
router.use(authMiddleware);

// 1. GET /api/invoices - Lấy danh sách hóa đơn của user hiện tại
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id }).sort({ createdAt: -1 });
    
    // Map _id to id for frontend compatibility
    const formatted = invoices.map(doc => {
      const obj = doc.toObject();
      obj.id = obj._id.toString();
      return obj;
    });

    return res.json({
      success: true,
      invoices: formatted
    });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải danh sách hóa đơn từ cơ sở dữ liệu'
    });
  }
});

// 2. POST /api/invoices - Lưu hóa đơn mới sau khi bóc tách
router.post('/', async (req, res) => {
  try {
    const invData = req.body;
    invData.userId = req.user._id;

    // Remove client temp id if present
    delete invData._id;
    delete invData.id;

    const newInvoice = new Invoice(invData);
    await newInvoice.save();

    const result = newInvoice.toObject();
    result.id = result._id.toString();

    return res.status(201).json({
      success: true,
      invoice: result,
      message: 'Đã lưu hóa đơn vào MongoDB'
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lưu hóa đơn: ' + error.message
    });
  }
});

// 3. PUT /api/invoices/:id - Cập nhật hóa đơn sau khi chỉnh sửa
router.put('/:id', async (req, res) => {
  try {
    const inv = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    }

    const updates = req.body;
    delete updates._id;
    delete updates.userId;

    Object.assign(inv, updates);
    await inv.save();

    const result = inv.toObject();
    result.id = result._id.toString();

    return res.json({
      success: true,
      invoice: result,
      message: 'Đã cập nhật hóa đơn'
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật hóa đơn'
    });
  }
});

// 4. DELETE /api/invoices/:id - Xóa 1 hóa đơn
router.delete('/:id', async (req, res) => {
  try {
    const inv = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!inv) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn cần xóa' });
    }

    return res.json({
      success: true,
      message: 'Đã xóa hóa đơn khỏi cơ sở dữ liệu'
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa hóa đơn'
    });
  }
});

// 5. DELETE /api/invoices - Xóa toàn bộ hóa đơn của user hiện tại
router.delete('/', async (req, res) => {
  try {
    await Invoice.deleteMany({ userId: req.user._id });
    return res.json({
      success: true,
      message: 'Đã dọn dẹp sạch toàn bộ hóa đơn của bạn'
    });
  } catch (error) {
    console.error('Clear invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa danh sách hóa đơn'
    });
  }
});

module.exports = router;
