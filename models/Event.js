const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  }
});

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  longDescription: {
    type: String,
    trim: true,
    maxlength: [5000, 'Long description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: [true, 'Event category is required'],
    enum: ['Conference', 'Workshop', 'Seminar', 'Concert', 'Sports', 'Exhibition', 'Other'],
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  duration: {
    type: String,
    required: [true, 'Duration is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  venue: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  mapsUrl: {
    type: String,
    trim: true
  },
  bannerImage: {
    type: String,
    required: [true, 'Banner image URL is required'],
    trim: true
  },
  gallery: [{
    type: String,
    trim: true
  }],
  
  userPrice: {
    type: Number,
    required: [true, 'User price is required'],
    min: [0, 'Price cannot be negative']
  },
  memberPrice: {
    type: Number,
    required: [true, 'Member price is required'],
    min: [0, 'Price cannot be negative']
  },
  guestPrice: {
    type: Number,
    required: [true, 'Guest price is required'],
    min: [0, 'Price cannot be negative']
  },
  
  maxCapacity: {
    type: Number,
    required: [true, 'Maximum capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  bookedSeats: {
    type: Number,
    default: 0
  },
  maxTicketsPerUser: {
    type: Number,
    default: 5,
    min: [1, 'Must allow at least 1 ticket per user']
  },
  maxTicketsPerMember: {
    type: Number,
    default: 10,
    min: [1, 'Must allow at least 1 ticket per member']
  },
  maxTicketsPerGuest: {
    type: Number,
    default: 3,
    min: [1, 'Must allow at least 1 ticket per guest']
  },
  
  organizer: {
    name: {
      type: String,
      required: [true, 'Organizer name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Organizer email is required'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    }
  },
  
  highlights: [{
    type: String,
    trim: true
  }],
  
  seatingType: {
    type: String,
    enum: ['Open', 'Reserved', 'Mixed'],
    default: 'Open'
  },
  
  ageRestriction: {
    type: String,
    enum: ['All Ages', '18+', '21+', 'Kids Only'],
    default: 'All Ages'
  },
  
  dresscode: {
    type: String,
    trim: true
  },
  
  specialNotes: {
    type: String,
    trim: true
  },
  
  terms: {
    type: String,
    trim: true
  },
  refundPolicy: {
    type: String,
    trim: true,
    default: 'No refunds available'
  },
  cancellationPolicy: {
    type: String,
    trim: true
  },
  
  faqs: [faqSchema],
  
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  registrationStartDate: {
    type: Date,
    default: Date.now
  },
  registrationEndDate: {
    type: Date
  },
  
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  
  hasRefreshments: {
    type: Boolean,
    default: false
  },
  hasParking: {
    type: Boolean,
    default: false
  },
  isWheelchairAccessible: {
    type: Boolean,
    default: false
  },
  hasWifi: {
    type: Boolean,
    default: false
  },
  
  viewCount: {
    type: Number,
    default: 0
  },
  favoriteCount: {
    type: Number,
    default: 0
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User',
    required: true
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

eventSchema.index({ startDate: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ location: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ featured: 1 });
eventSchema.index({ 'organizer.name': 1 });
eventSchema.index({ tags: 1 });

eventSchema.index({
  title: 'text',
  description: 'text',
  location: 'text',
  tags: 'text'
});

eventSchema.virtual('availableSeats').get(function() {
  return this.maxCapacity - this.bookedSeats;
});

eventSchema.virtual('isSoldOut').get(function() {
  return this.bookedSeats >= this.maxCapacity;
});

eventSchema.virtual('isUpcoming').get(function() {
  return this.startDate > new Date();
});

eventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
});

eventSchema.virtual('isCompleted').get(function() {
  return this.endDate < new Date();
});

eventSchema.pre('save', function(next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    const error = new Error('End date must be after start date');
    return next(error);
  }
  
  if (this.memberPrice > this.userPrice) {
    const error = new Error('Member price cannot be higher than user price');
    return next(error);
  }
  
  next();
});

eventSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save({ validateBeforeSave: false });
};

eventSchema.methods.incrementFavoriteCount = function() {
  this.favoriteCount += 1;
  return this.save({ validateBeforeSave: false });
};

eventSchema.methods.decrementFavoriteCount = function() {
  this.favoriteCount = Math.max(0, this.favoriteCount - 1);
  return this.save({ validateBeforeSave: false });
};

eventSchema.methods.updateBookedSeats = function(seatsToAdd) {
  this.bookedSeats += seatsToAdd;
  return this.save({ validateBeforeSave: false });
};

eventSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SRS_Event', eventSchema);