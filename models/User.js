const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    // required: [true, 'Last name is required'],
    trim: true,
    // maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    // match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    // match: [/^[+]?[1-9][\d]{9,14}$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  memberId: {
  type: String,
  unique: true,
  sparse: true,
  trim: true,
  uppercase: true
},
  role: {
    type: String,
    enum: ['user', 'member', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: null
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  preferences: {
    eventCategories: [String],
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  
  membershipTier: {
    type: String,
    enum: ['Gold', 'Premium', 'Elite'],
    default: null
  },
  membershipDate: {
    type: Date
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  sponsoredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});







userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});


userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});


userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};


userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};


userSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  return this.save({ validateBeforeSave: false });
};


userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter(
    tokenObj => tokenObj.expiresAt > now
  );
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('SRS_User', userSchema);