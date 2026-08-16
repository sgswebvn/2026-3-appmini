const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'billflow_super_secret_jwt_token_2026';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc token không hợp lệ'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản không tồn tại'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản này đã bị khóa. Vui lòng liên hệ Quản trị viên!'
      });
    }

    // Check if tester account has expired (5-minute limit)
    if (user.role === 'tester' && user.isExpired()) {
      user.isLocked = true;
      await user.save();

      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_EXPIRED',
        message: 'Thời hạn dùng thử 5 phút của bạn đã kết thúc. Tài khoản đã tự động khóa!'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực hệ thống'
    });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác này'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminOnly,
  JWT_SECRET
};
