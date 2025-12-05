const Event = require('../models/Event');
const Favorite = require('../models/Favorite');

// Get all events
exports.getAllEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      location,
      search,
      priceRange,
      dateRange,
      status = 'published'
    } = req.query;
    const filter = { status };
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location, 'i');
   
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    // Price range filter
    if (priceRange) {
      const [min, max] = priceRange.split('-');
      if (max === '+') {
        filter.userPrice = { $gte: parseInt(min) };
      } else {
        filter.userPrice = { $gte: parseInt(min), $lte: parseInt(max) };
      }
    }
    // Date range filter
    if (dateRange) {
      const now = new Date();
      switch (dateRange) {
        case 'today':
          filter.startDate = {
            $gte: new Date(now.setHours(0, 0, 0, 0)),
            $lt: new Date(now.setHours(23, 59, 59, 999))
          };
          break;
        case 'tomorrow':
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          filter.startDate = {
            $gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
            $lt: new Date(tomorrow.setHours(23, 59, 59, 999))
          };
          break;
        case 'this-week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          filter.startDate = { $gte: weekStart, $lte: weekEnd };
          break;
        case 'this-month':
          filter.startDate = {
            $gte: new Date(now.getFullYear(), now.getMonth(), 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
          };
          break;
        case 'next-month':
          filter.startDate = {
            $gte: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            $lt: new Date(now.getFullYear(), now.getMonth() + 2, 1)
          };
          break;
      }
    }
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { startDate: 1 },
      populate: {
        path: 'createdBy',
        select: 'firstName lastName email'
      }
    };
    const events = await Event.paginate(filter, options);
    res.status(200).json({
      status: 'success',
      data: events.docs,
      pagination: {
        currentPage: events.page,
        totalPages: events.totalPages,
        totalEvents: events.totalDocs,
        hasNext: events.hasNextPage,
        hasPrev: events.hasPrevPage
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch events',
      error: error.message
    });
  }
};

// Get event by ID
exports.getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    await event.incrementViewCount();
    res.status(200).json({
      status: 'success',
      data: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch event',
      error: error.message
    });
  }
};

// Get featured events
exports.getFeaturedEvents = async (req, res) => {
  try {
    const events = await Event.find({
      featured: true,
      status: 'published',
      startDate: { $gte: new Date() }
    })
    .sort({ startDate: 1 })
    .limit(6);
    res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch featured events',
      error: error.message
    });
  }
};

// Get upcoming events
exports.getUpcomingEvents = async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    const events = await Event.find({
      status: 'published',
      startDate: { $gte: new Date() }
    })
    .sort({ startDate: 1 })
    .limit(parseInt(limit));
    res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch upcoming events',
      error: error.message
    });
  }
};

// Search events
exports.searchEvents = async (req, res) => {
  try {
    const { q, category, location, priceRange } = req.query;
    const filter = {
      status: 'published',
      startDate: { $gte: new Date() }
    };
    if (q) {
      filter.$text = { $search: q };
    }
    if (category) filter.category = category;
    if (location) filter.location = new RegExp(location, 'i');
    if (priceRange) {
      const [min, max] = priceRange.split('-');
      if (max === '+') {
        filter.userPrice = { $gte: parseInt(min) };
      } else {
        filter.userPrice = { $gte: parseInt(min), $lte: parseInt(max) };
      }
    }
    const events = await Event.find(filter)
      .sort(q ? { score: { $meta: 'textScore' } } : { startDate: 1 })
      .limit(20);
    res.status(200).json({
      status: 'success',
      data: events
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Search failed',
      error: error.message
    });
  }
};

// Create event (Admin only)
exports.createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user._id
    };
    const event = await Event.create(eventData);
    res.status(201).json({
      status: 'success',
      message: 'Event created successfully',
      data: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create event',
      error: error.message
    });
  }
};

// Update event (Admin only)
exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        lastModifiedBy: req.user._id
      },
      { new: true, runValidators: true }
    );
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Event updated successfully',
      data: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update event',
      error: error.message
    });
  }
};

// Delete event (Admin only)
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id
      // { isActive: false },
      // { new: true }
    );
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete event',
      error: error.message
    });
  }
};

// Update event status (Admin only)
exports.updateEventStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status, lastModifiedBy: req.user._id },
      { new: true }
    );
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Event status updated successfully',
      data: event
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update event status',
      error: error.message
    });
  }
};

// Toggle favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user._id;
    const existingFavorite = await Favorite.findOne({
      user: userId,
      event: eventId
    });
    if (existingFavorite) {
      await Favorite.findByIdAndDelete(existingFavorite._id);
      await Event.findByIdAndUpdate(eventId, { $inc: { favoriteCount: -1 } });
     
      res.status(200).json({
        status: 'success',
        message: 'Removed from favorites',
        isFavorite: false
      });
    } else {
      await Favorite.create({ user: userId, event: eventId });
      await Event.findByIdAndUpdate(eventId, { $inc: { favoriteCount: 1 } });
     
      res.status(200).json({
        status: 'success',
        message: 'Added to favorites',
        isFavorite: true
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to toggle favorite',
      error: error.message
    });
  }
};