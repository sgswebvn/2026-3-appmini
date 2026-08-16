require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/billflow';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (frontend)
app.use(express.static(__dirname));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/ai', require('./routes/ai'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  });
});

// Seed default Admin account
async function seedDefaultAdmin() {
  try {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const admin = new User({
        username: adminUsername,
        password: adminPassword,
        role: 'admin',
        durationMinutes: 999999,
        note: 'Tài khoản Quản trị viên tối cao (System Admin)'
      });
      await admin.save();
      console.log(`[Database] Đã tạo tài khoản Admin mặc định: username="${adminUsername}" | password="${adminPassword}"`);
    } else {
      console.log(`[Database] Tài khoản Admin đã sẵn sàng: username="${existingAdmin.username}"`);
    }
  } catch (err) {
    console.error('[Database] Lỗi khi tạo admin mặc định:', err.message);
  }
}

// Connect to MongoDB
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  try {
    console.log(`[Database] Đang kết nối tới MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log('[Database] Kết nối MongoDB thành công!');
    await seedDefaultAdmin();
  } catch (err) {
    console.warn('[Database] Cảnh báo kết nối MongoDB:', err.message);
    console.log('[Database] Hệ thống sẽ thử kết nối lại hoặc bạn có thể cấu hình MONGODB_URI trong file .env');
  }
}

connectDB();

// Fallback to index.html for SPA routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening if running directly
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BillFlow AI Server đang chạy tại http://localhost:${PORT}/`);
    console.log(`👤 Tài khoản Admin mặc định: admin / admin123`);
    console.log(`====================================================`);
  });
}

module.exports = app;
