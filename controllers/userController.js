const User = require('../models/User');
const Event = require('../models/Event');
const Favorite = require('../models/Favorite');
const Cart = require('../models/Cart');

// Get user favorites
exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate('event')
      .sort({ createdAt: -1 });

    const events = favorites.map(fav => fav.event).filter(event => event);

    res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch favorites',
      error: error.message
    });
  }
};

// Add to favorites
exports.addToFavorites = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user._id;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }

    // Check if already in favorites
    const existingFavorite = await Favorite.findOne({
      user: userId,
      event: eventId
    });

    if (existingFavorite) {
      return res.status(400).json({
        status: 'error',
        message: 'Event already in favorites'
      });
    }

    // Add to favorites
    await Favorite.create({ user: userId, event: eventId });
    await Event.findByIdAndUpdate(eventId, { $inc: { favoriteCount: 1 } });

    res.status(200).json({
      status: 'success',
      message: 'Added to favorites'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to add to favorites',
      error: error.message
    });
  }
};

// Remove from favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user._id;

    const favorite = await Favorite.findOneAndDelete({
      user: userId,
      event: eventId
    });

    if (!favorite) {
      return res.status(404).json({
        status: 'error',
        message: 'Favorite not found'
      });
    }

    await Event.findByIdAndUpdate(eventId, { $inc: { favoriteCount: -1 } });

    res.status(200).json({
      status: 'success',
      message: 'Removed from favorites'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove from favorites',
      error: error.message
    });
  }
};

// Get cart
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id })
      .populate('items.event');

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }

    res.status(200).json({
      status: 'success',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch cart',
      error: error.message
    });
  }
};

// Add to cart
exports.addToCart = async (req, res) => {
  try {
    const { eventId, seatCount, bookingType } = req.body;
    const userId = req.user._id;

    // Get event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }

    // Calculate price
    const unitPrice = bookingType === 'member' ? event.memberPrice :
                     bookingType === 'guest' ? event.guestPrice :
                     event.userPrice;

    // Get or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Add item to cart
    await cart.addItem(event, seatCount, bookingType, unitPrice);

    // Populate cart items
    await cart.populate('items.event');

    res.status(200).json({
      status: 'success',
      message: 'Added to cart',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to add to cart',
      error: error.message
    });
  }
};

// Update cart item
exports.updateCartItem = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { seatCount, bookingType } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        status: 'error',
        message: 'Cart not found'
      });
    }

    await cart.updateItemQuantity(eventId, bookingType, seatCount);
    await cart.populate('items.event');

    res.status(200).json({
      status: 'success',
      message: 'Cart updated',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update cart',
      error: error.message
    });
  }
};

// Remove from cart
exports.removeFromCart = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { bookingType } = req.query;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        status: 'error',
        message: 'Cart not found'
      });
    }

    await cart.removeItem(eventId, bookingType);
    await cart.populate('items.event');

    res.status(200).json({
      status: 'success',
      message: 'Removed from cart',
      data: cart
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to remove from cart',
      error: error.message
    });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        status: 'error',
        message: 'Cart not found'
      });
    }

    await cart.clearCart();

    res.status(200).json({
      status: 'success',
      message: 'Cart cleared'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cart',
      error: error.message
    });
  }
};