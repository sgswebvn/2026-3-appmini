const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const { authMiddleware, adminOnly, JWT_SECRET } = require('../middleware/auth');

// 1. POST /api/auth/login - Đăng nhập cho Admin & Người dùng test
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác'
      });
    }

    // Check locked status
    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản này đã bị khóa hoặc hết hạn dùng thử!'
      });
    }

    // If first login for tester, start the 5-minute countdown clock
    if (user.role === 'tester') {
      if (!user.firstLoginAt) {
        user.firstLoginAt = new Date();
        const durationMs = (user.durationMinutes || 5) * 60 * 1000;
        user.expiresAt = new Date(Date.now() + durationMs);
        await user.save();
      } else if (user.isExpired()) {
        user.isLocked = true;
        await user.save();
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_EXPIRED',
          message: 'Tài khoản test của bạn đã hết hạn 5 phút dùng thử!'
        });
      }
    }

    // Sign JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        durationMinutes: user.durationMinutes,
        firstLoginAt: user.firstLoginAt,
        expiresAt: user.expiresAt,
        remainingSeconds: user.getRemainingSeconds(),
        isLocked: user.isLocked
      },
      message: `Đăng nhập thành công với vai trò ${user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Người dùng Test'}`
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng nhập: ' + error.message
    });
  }
});

// 2. GET /api/auth/me - Lấy thông tin user hiện tại & thời gian còn lại
router.get('/me', authMiddleware, async (req, res) => {
  const user = req.user;
  return res.json({
    success: true,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      durationMinutes: user.durationMinutes,
      firstLoginAt: user.firstLoginAt,
      expiresAt: user.expiresAt,
      remainingSeconds: user.getRemainingSeconds(),
      isLocked: user.isLocked
    }
  });
});

// 3. POST /api/auth/users - Admin cấp tài khoản test mới
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { username, password, durationMinutes = 5, note = '' } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp username và password cho tài khoản mới'
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Tài khoản "${cleanUsername}" đã tồn tại trên hệ thống`
      });
    }

    const parsedMinutes = Math.max(1, parseInt(durationMinutes, 10) || 5);

    const newUser = new User({
      username: cleanUsername,
      password,
      role: 'tester',
      durationMinutes: parsedMinutes,
      note,
      createdBy: req.user.username
    });

    await newUser.save();

    return res.json({
      success: true,
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role,
        durationMinutes: newUser.durationMinutes,
        note: newUser.note,
        createdAt: newUser.createdAt
      },
      message: `Đã cấp tài khoản test "${cleanUsername}" với thời hạn ${parsedMinutes} phút thành công!`
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo tài khoản: ' + error.message
    });
  }
});

// 4. GET /api/auth/users - Admin xem danh sách tất cả tài khoản
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'tester' }).sort({ createdAt: -1 });

    const formatted = users.map(u => {
      const remainingSec = u.getRemainingSeconds();
      let status = 'active';
      if (u.isLocked) {
        status = 'locked';
      } else if (u.firstLoginAt && remainingSec === 0) {
        status = 'expired';
      } else if (!u.firstLoginAt) {
        status = 'pending';
      }

      return {
        id: u._id,
        username: u.username,
        role: u.role,
        durationMinutes: u.durationMinutes,
        firstLoginAt: u.firstLoginAt,
        expiresAt: u.expiresAt,
        remainingSeconds: remainingSec,
        isLocked: u.isLocked,
        status,
        note: u.note,
        createdAt: u.createdAt
      };
    });

    return res.json({
      success: true,
      users: formatted
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách người dùng'
    });
  }
});

// 5. PATCH /api/auth/users/:id - Admin khóa / mở khóa / gia hạn thời gian
router.patch('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const { isLocked, extendMinutes, resetPassword } = req.body;

    if (typeof isLocked === 'boolean') {
      user.isLocked = isLocked;
    }

    if (extendMinutes && Number(extendMinutes) > 0) {
      const extraMs = Number(extendMinutes) * 60 * 1000;
      const baseTime = (user.expiresAt && user.expiresAt > new Date()) ? user.expiresAt.getTime() : Date.now();
      user.expiresAt = new Date(baseTime + extraMs);
      user.durationMinutes = (user.durationMinutes || 0) + Number(extendMinutes);
      user.isLocked = false; // Auto unlock when extended
    }

    if (resetPassword) {
      user.password = resetPassword;
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Đã cập nhật tài khoản thành công',
      user: {
        id: user._id,
        username: user.username,
        isLocked: user.isLocked,
        expiresAt: user.expiresAt,
        remainingSeconds: user.getRemainingSeconds()
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + error.message });
  }
});

// 6. DELETE /api/auth/users/:id - Admin xóa tài khoản
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản Admin' });
    }

    await Invoice.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: `Đã xóa tài khoản "${user.username}" và toàn bộ dữ liệu liên quan`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi khi xóa tài khoản' });
  }
});

module.exports = router;
