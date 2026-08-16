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
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use(express.static(__dirname));

// Connect to MongoDB with caching (Optimized for both Local and Vercel Serverless)
let cachedPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedPromise) {
    console.log(`[Database] Đang kết nối tới MongoDB...`);
    cachedPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      bufferCommands: false // Disable buffering so queries don't hang if disconnected
    }).then(async (conn) => {
      console.log('[Database] Kết nối MongoDB thành công!');
      await seedDefaultAdmin();
      return conn;
    }).catch((err) => {
      cachedPromise = null;
      console.error('[Database] Lỗi kết nối MongoDB:', err.message);
      throw err;
    });
  }

  return cachedPromise;
}

// Seed default Admin account if not exists
async function seedDefaultAdmin() {
  try {
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await User.findOne({ username: adminUsername });
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

// Ensure Database is connected before handling any API requests
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Không thể kết nối đến cơ sở dữ liệu MongoDB. Vui lòng kiểm tra cấu hình MONGODB_URI trong .env hoặc cài đặt IP Whitelist (0.0.0.0/0) trong MongoDB Atlas: ' + err.message
    });
  }
});

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

// Fallback to index.html for SPA routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start listening if running directly
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Pre-connect on startup
  connectDB().catch(e => console.warn('[Database] Pre-connect warning:', e.message));

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BillFlow AI Server đang chạy tại http://localhost:${PORT}/`);
    console.log(`👤 Tài khoản Admin mặc định: admin / admin123`);
    console.log(`====================================================`);
  });
}

module.exports = app;
