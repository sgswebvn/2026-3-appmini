const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'tester'],
    default: 'tester'
  },
  durationMinutes: {
    type: Number,
    default: 5 // Default 5 minutes for tester accounts
  },
  firstLoginAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  note: {
    type: String,
    default: ''
  },
  createdBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if test account has expired
userSchema.methods.isExpired = function() {
  if (this.role === 'admin') return false;
  if (!this.expiresAt) return false;
  return Date.now() > new Date(this.expiresAt).getTime();
};

// Get remaining seconds
userSchema.methods.getRemainingSeconds = function() {
  if (this.role === 'admin') return Infinity;
  if (!this.expiresAt) return this.durationMinutes * 60;
  const rem = Math.floor((new Date(this.expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, rem);
};

module.exports = mongoose.model('User', userSchema);
