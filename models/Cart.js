const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_Event',
    required: true
  },
  seatCount: {
    type: Number,
    required: true,
    min: [1, 'Seat count must be at least 1']
  },
  bookingType: {
    type: String,
    enum: ['user', 'member', 'guest'],
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  }
}, {
  _id: false
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

cartSchema.pre('save', function(next) {
  this.totalAmount = this.items.reduce((total, item) => total + item.totalPrice, 0);
  this.lastUpdated = new Date();
  next();
});


cartSchema.methods.addItem = function(event, seatCount, bookingType, unitPrice) {
  const existingItemIndex = this.items.findIndex(
    item => item.event.toString() === event._id.toString() && 
            item.bookingType === bookingType
  );
  
  const totalPrice = unitPrice * seatCount;
  
  if (existingItemIndex > -1) {
    this.items[existingItemIndex].seatCount += seatCount;
    this.items[existingItemIndex].totalPrice += totalPrice;
  } else {
    this.items.push({
      event: event._id,
      seatCount,
      bookingType,
      unitPrice,
      totalPrice
    });
  }
  
  return this.save();
};

cartSchema.methods.removeItem = function(eventId, bookingType) {
  this.items = this.items.filter(
    item => !(item.event.toString() === eventId.toString() && 
              item.bookingType === bookingType)
  );
  
  return this.save();
};

cartSchema.methods.updateItemQuantity = function(eventId, bookingType, seatCount) {
  const itemIndex = this.items.findIndex(
    item => item.event.toString() === eventId.toString() && 
            item.bookingType === bookingType
  );
  
  if (itemIndex > -1) {
    if (seatCount <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].seatCount = seatCount;
      this.items[itemIndex].totalPrice = this.items[itemIndex].unitPrice * seatCount;
    }
  }
  
  return this.save();
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  return this.save();
};

module.exports = mongoose.model('SRS_Cart', cartSchema);