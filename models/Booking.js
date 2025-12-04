const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_Event',
    required: [true, 'Event is required']
  },
  bookingType: {
    type: String,
    enum: ['user', 'member', 'guest', 'offline'],
    required: [true, 'Booking type is required']
  },
  seatCount: {
    type: Number,
    required: [true, 'Seat count is required'],
    min: [1, 'Must book at least 1 seat']
  },
  memberTicketCount: { type: Number, default: 0 }, // NEW from PDF
  guestTicketCount: { type: Number, default: 0 }, // NEW
  kidTicketCount: { type: Number, default: 0 }, // NEW
  memberVegCount: { type: Number, default: 0 }, // NEW
  memberNonVegCount: { type: Number, default: 0 }, // NEW
  guestVegCount: { type: Number, default: 0 }, // NEW
  guestNonVegCount: { type: Number, default: 0 }, // NEW
  kidVegCount: { type: Number, default: 0 }, // NEW
  kidNonVegCount: { type: Number, default: 0 }, // NEW
  attendeeNamesJson: { type: JSON, default: [] }, // NEW: Store optional names as JSON array
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Price cannot be negative']
  },
  memberName:{
    type:String,
  },
  contactNumber:{
    type:String
  },
  eventName:{type:String},
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  grossAmount: { type: Number, min: 0 }, // NEW
  discountCode: { type: String }, // NEW
  discountPercent: { type: Number, default: 0 }, // NEW
  discountAmount: { type: Number, default: 0 }, // NEW
  finalAmount: { type: Number, min: 0 }, // NEW
  sponsoringMemberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  },
  memberIdInput: { type: String },
  guestDetails: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected', 'confirmed', 'cancelled', 'pending', 'completed', 'refunded'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'cash', 'upi', 'bank_transfer', 'other'], // UPDATED with PDF modes
    default: 'razorpay'
  },
  paymentDetails: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    transactionId: String,
    utrNumber: { type: String }, // NEW: UTR
    paymentDate: Date,
    refundId: String,
    refundAmount: Number,
    refundDate: Date
  },
  qrCode: {
    type: String,
    unique: true
  },
  qrCodeImage: {
    type: String 
  },
  qrScanLimit: {
    type: Number
  },
  qrScanCount: {
    type: Number,
    default: 0
  },
  qrScans: [{
    scannedAt: {
      type: Date,
      default: Date.now
    },
    scannedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SRS_User'
    },
    location: String,
    notes: String
  }],
  bookingDate: {
    type: Date,
    default: Date.now
  },
  attendeeDetails: [{
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    age: Number,
    dietaryRestrictions: String,
    specialRequirements: String
  }],
  specialRequests: {
    type: String,
    trim: true
  },
  confirmationEmailSent: {
    type: Boolean,
    default: false
  },
  reminderEmailSent: {
    type: Boolean,
    default: false
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

bookingSchema.index({ user: 1 });
bookingSchema.index({ event: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ qrCode: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ bookingDate: -1 });

bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.bookingId = `SRS${timestamp}${random}`;
  }

  if (this.isNew) {
    this.qrScanLimit = this.seatCount;
  }

  // Validate meal counts
  const totalMeals = this.memberVegCount + this.memberNonVegCount + this.guestVegCount + this.guestNonVegCount + this.kidVegCount + this.kidNonVegCount;
  if (totalMeals !== this.seatCount) {
    return next(new Error('Total meal count must match seat count'));
  }

  next();
});

bookingSchema.virtual('remainingScans').get(function() {
  return Math.max(0, this.qrScanLimit - this.qrScanCount);
});

bookingSchema.virtual('isFullyScanned').get(function() {
  return this.qrScanCount >= this.qrScanLimit;
});

bookingSchema.virtual('canBeScanned').get(function() {
  return this.status === 'confirmed' && 
         this.paymentStatus === 'completed' && 
         this.qrScanCount < this.qrScanLimit;
});

bookingSchema.methods.scanQR = function(scannedBy, location, notes) {
  if (!this.canBeScanned) {
    throw new Error('QR code cannot be scanned');
  }
  
  this.qrScans.push({
    scannedBy,
    location,
    notes
  });
  this.qrScanCount += 1;
  
  return this.save();
};

bookingSchema.methods.cancelBooking = function(reason, cancelledBy) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  
  return this.save();
};

bookingSchema.methods.confirmBooking = function() {
  this.status = 'confirmed';
  this.paymentStatus = 'completed';
  
  return this.save();
};

bookingSchema.methods.completeBooking = function() {
  this.status = 'completed';
  
  return this.save();
};

module.exports = mongoose.model('SRS_Booking', bookingSchema);