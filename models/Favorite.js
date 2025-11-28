const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SRS_Event',
    required: true
  }
}, {
  timestamps: true
});


favoriteSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('SRS_Favorite', favoriteSchema);