const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const QRCode = require('qrcode');
const crypto = require('crypto');
const razorpayService = require('../services/razorpayService');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');

// Create booking
exports.createBooking = async (req, res) => {
  try {
    const { eventId, seatCount, bookingType, guestDetails, sponsoringMemberId } = req.body;
    const userId = req.user._id;

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }

    // Check availability
    if (event.bookedSeats + seatCount > event.maxCapacity) {
      return res.status(400).json({
        status: 'error',
        message: 'Not enough seats available'
      });
    }

    // Check booking limits
    const maxTickets = bookingType === 'member' ? event.maxTicketsPerMember :
                      bookingType === 'guest' ? event.maxTicketsPerGuest :
                      event.maxTicketsPerUser;

    if (seatCount > maxTickets) {
      return res.status(400).json({
        status: 'error',
        message: `Maximum ${maxTickets} tickets allowed for ${bookingType} booking`
      });
    }

    // Calculate price
    const unitPrice = bookingType === 'member' ? event.memberPrice :
                     bookingType === 'guest' ? event.guestPrice :
                     event.userPrice;
    
    const totalAmount = unitPrice * seatCount;

    // Generate QR code
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingId = `SRS${timestamp}${random}`;
  
  // Set QR scan limit equal to seat count
     const qrScanLimit = seatCount;
    // Create booking
    const bookingData = {
      user: userId,
      event: eventId,
      bookingId,
      bookingType,
      seatCount,
      unitPrice,
      totalAmount,
      qrCode,
      qrCodeImage,
      qrScanLimit,
      guestDetails: bookingType === 'guest' ? guestDetails : undefined,
      sponsoringMemberId: bookingType === 'guest' ? sponsoringMemberId : undefined
    };

    const booking = await Booking.create(bookingData);

    // Update event booked seats
    await event.updateBookedSeats(seatCount);

    // Add loyalty points for members
    if (req.user.role === 'member') {
      await req.user.addLoyaltyPoints(10 * seatCount);
    }

    res.status(201).json({
      status: 'success',
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to create booking',
      error: error.message
    });
  }
};

// Get user bookings
exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;

    const bookings = await Booking.find({ user: userId })
      .populate({
        path: 'event',
        select: 'title startDate endDate location bannerImage memberPrice guestPrice userPrice maxCapacity',
        match: { isDeleted: { $ne: true } } // safety
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out bookings where event was deleted (populate returns null)
    const validBookings = bookings.filter(b => b.event !== null);

    res.status(200).json({
      status: 'success',
      data: validBookings,
      count: validBookings.length
    });

  } catch (error) {
    console.error('getUserBookings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to load your bookings'
    });
  }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('event')
      .populate('user', 'firstName lastName email phone')
      .populate('sponsoringMemberId', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking or is admin
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    res.status(200).json({
      status: 'success',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check ownership
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Booking is already cancelled'
      });
    }

    // Cancel booking
    await booking.cancelBooking(reason, req.user._id);

    // Update event booked seats
    const event = await Event.findById(booking.event);
    await event.updateBookedSeats(-booking.seatCount);

    res.status(200).json({
      status: 'success',
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
};

// Download ticket
exports.downloadTicket = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('event')
      .populate('user', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Check ownership
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }

    // Generate PDF ticket
    const pdfBuffer = await pdfService.generateTicket(booking);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ticket-${booking.bookingId}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate ticket',
      error: error.message
    });
  }
};

// Scan QR code
exports.scanQRCode = async (req, res) => {
  try {
    const { qrCode, location, notes } = req.body;

    const booking = await Booking.findOne({ qrCode })
      .populate('event', 'title startDate location')
      .populate('user', 'firstName lastName email');

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Invalid QR code'
      });
    }

    if (!booking.canBeScanned) {
      return res.status(400).json({
        status: 'error',
        message: 'QR code cannot be scanned',
        reason: booking.status !== 'confirmed' ? 'Booking not confirmed' :
                booking.paymentStatus !== 'completed' ? 'Payment not completed' :
                'QR code fully used'
      });
    }

    // Scan QR code
    await booking.scanQR(req.user._id, location, notes);

    res.status(200).json({
      status: 'success',
      message: 'QR code scanned successfully',
      data: {
        booking: {
          bookingId: booking.bookingId,
          event: booking.event,
          user: booking.user,
          seatCount: booking.seatCount,
          remainingScans: booking.remainingScans
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to scan QR code',
      error: error.message
    });
  }
};

// Initiate payment
exports.initiatePayment = async (req, res) => {
  try {
    const { bookingId, amount } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    // Create Razorpay order
    const order = await razorpayService.createOrder(amount, bookingId);

    // Update booking with payment details
    booking.paymentDetails.razorpayOrderId = order.id;
    await booking.save();

    res.status(200).json({
      status: 'success',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    // Verify payment signature
    const isValid = razorpayService.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment signature'
      });
    }

    // Update booking
    const booking = await Booking.findById(bookingId);
    booking.paymentStatus = 'completed';
    booking.status = 'confirmed';
    booking.paymentDetails.razorpayPaymentId = razorpay_payment_id;
    booking.paymentDetails.razorpaySignature = razorpay_signature;
    booking.paymentDetails.paymentDate = new Date();
    
    await booking.save();

    // Send confirmation email
    await emailService.sendBookingConfirmation(booking);

    res.status(200).json({
      status: 'success',
      message: 'Payment verified successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Payment verification failed',
      error: error.message
    });
  }
};

// Get all bookings (Admin)
exports.getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, eventId, userId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (eventId) filter.event = eventId;
    if (userId) filter.user = userId;

    const bookings = await Booking.find(filter)
      .populate('event', 'title startDate location')
      .populate('user', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBookings: total
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

// Create manual booking (Admin)
exports.createManualBooking = async (req, res) => {
  try {
    const { eventId, userDetails, seatCount, bookingType, paymentMethod, transactionId } = req.body;

    // Get or create user
    let user = await User.findOne({ email: userDetails.email });
    if (!user) {
      user = await User.create({
        ...userDetails,
        password: 'temp123', // Temporary password
        role: 'user'
      });
    }

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
    
    const totalAmount = unitPrice * seatCount;

    // Generate QR code
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);

    // Create booking
    const booking = await Booking.create({
      user: user._id,
      event: eventId,
      bookingType,
      seatCount,
      unitPrice,
      totalAmount,
      qrCode,
      qrCodeImage,
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentMethod,
      paymentDetails: {
        transactionId,
        paymentDate: new Date()
      },
      createdBy: req.user._id
    });

    // Update event booked seats
    await event.updateBookedSeats(seatCount);

    res.status(201).json({
      status: 'success',
      message: 'Manual booking created successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create manual booking',
      error: error.message
    });
  }
};

// Update booking status (Admin)
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, lastModifiedBy: req.user._id },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        status: 'error',
        message: 'Booking not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Booking status updated successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update booking status',
      error: error.message
    });
  }
};