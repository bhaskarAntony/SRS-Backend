const Booking = require('../models/Booking');
const Event = require('../models/Event');
const User = require('../models/User');
const QRCode = require('qrcode');
const crypto = require('crypto');
const razorpayService = require('../services/razorpayService');
const emailService = require('../services/emailService');
const pdfService = require('../services/pdfService');

exports.createBooking = async (req, res) => {
  try {
    const { eventId, seatCount, bookingType, guestDetails, sponsoringMemberId } = req.body;
    const userId = req.user._id;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
   
    if (event.bookedSeats + seatCount > event.maxCapacity) {
      return res.status(400).json({
        status: 'error',
        message: 'Not enough seats available'
      });
    }
   
    const maxTickets = bookingType === 'member' ? event.maxTicketsPerMember :
                      bookingType === 'guest' ? event.maxTicketsPerGuest :
                      event.maxTicketsPerUser;
    if (seatCount > maxTickets) {
      return res.status(400).json({
        status: 'error',
        message: `Maximum ${maxTickets} tickets allowed for ${bookingType} booking`
      });
    }
   
    const unitPrice = bookingType === 'member' ? event.memberPrice :
                     bookingType === 'guest' ? event.guestPrice :
                     event.userPrice;
   
    const totalAmount = unitPrice * seatCount;
   
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingId = `SRS${timestamp}${random}`;
 
 
     const qrScanLimit = seatCount;
   
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
   
    await event.updateBookedSeats(seatCount);
   
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

exports.getUserBookings = async (req, res) => {
    console.log("userId = ", req.user);
  try {
    const userId = req.user._id;
    var bookings = [];
    if(req.user.role=="admin"){
      bookings = await Booking.find()
      .populate({
        path: 'event',
        select: 'title startDate endDate location bannerImage memberPrice guestPrice userPrice maxCapacity',
        match: { isDeleted: { $ne: true } }
      })
      .sort({ createdAt: -1 })
      .lean();
    }else{
      bookings = await Booking.find({ user: userId })
      .populate({
        path: 'event',
        select: 'title startDate endDate location bannerImage memberPrice guestPrice userPrice maxCapacity',
        match: { isDeleted: { $ne: true } }
      })
      .sort({ createdAt: -1 })
      .lean();
    }
   
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
   
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }
   
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Booking is already cancelled'
      });
    }
   
    await booking.cancelBooking(reason, req.user._id);
   
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
    if (booking.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Access denied'
      });
    }
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
    const order = await razorpayService.createOrder(amount, bookingId);
    booking.paymentDetails.razorpayOrderId = order.id;
    await booking.save();
    res.status(200).json({
      status: 'success',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: "rzp_test_RluprVlNeV6oUv"
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

exports.verifyPayment = async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing payment details'
      });
    }
    const isValid = razorpayService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );
    if (!isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid payment signature'
      });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ status: 'error', message: 'Booking not found' });
    }
    booking.paymentStatus = 'completed';
    booking.status = 'confirmed';
    booking.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentDate: new Date()
    };
    await booking.save();
    const qrCodeImage = await QRCode.toDataURL(booking.qrCode);
    booking.qrCodeImage = qrCodeImage;
    await booking.save();
    res.json({
      status: 'success',
      message: 'Payment verified',
      data: booking
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error during verification'
    });
  }
};

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

exports.createManualBooking = async (req, res) => {
  try {
    const { eventId, userDetails, seatCount, bookingType, paymentMethod, transactionId } = req.body;
    let user = await User.findOne({ email: userDetails.email });
    if (!user) {
      user = await User.create({
        ...userDetails,
        password: 'temp123',
        role: 'user'
      });
    }
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: 'error',
        message: 'Event not found'
      });
    }
    const unitPrice = bookingType === 'member' ? event.memberPrice :
                     bookingType === 'guest' ? event.guestPrice :
                     event.userPrice;
   
    const totalAmount = unitPrice * seatCount;
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);
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

exports.createGuestRequest = async (req, res) => {
  try {
    const { eventId, seatCount, guestDetails, memberIdInput } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    const member = await User.findOne({ memberId: memberIdInput.toUpperCase(), role: 'member' });
    if (!member) {
      return res.status(400).json({ message: "Invalid Member ID" });
    }
    const unitPrice = event.guestPrice;
    const totalAmount = unitPrice * seatCount;
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingId = `SRS_GUEST${timestamp}${random}`;
 
     const qrScanLimit = seatCount;
    const booking = await Booking.create({
      event: eventId,
      bookingType: 'guest',
      seatCount,
      bookingId,
      unitPrice,
      qrCode,
      totalAmount,
      guestDetails,
      qrScanLimit,
      qrCodeImage,
      sponsoringMemberId: member._id,
      memberIdInput: memberIdInput.toUpperCase(),
      status: 'pending_approval'
    });
    res.status(201).json({
      success: true,
      message: "Request sent to member for approval",
      data: { bookingId: booking.bookingId }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveGuestRequest = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.bookingType !== 'guest') {
      return res.status(404).json({ message: "Invalid request" });
    }
    if (booking.sponsoringMemberId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    booking.status = 'approved';
    booking.approvalDate = new Date();
    await booking.save();
    res.json({ success: true, message: "Guest request approved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.rejectGuestRequest = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.sponsoringMemberId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    booking.status = 'rejected';
    booking.rejectionReason = req.body.reason || "Not approved";
    await booking.save();
    res.json({ success: true, message: "Request rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getGuestBookingStatus = async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId })
      .populate('event', 'title startDate location bannerImage guestPrice')
      .select('bookingId status totalAmount seatCount guestDetails event createdAt');
    if (!booking) return res.status(404).json({ message: "Not found" });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMemberRequests = async (req, res) => {
  try {
   
    const requests = await Booking.find({ sponsoringMemberId: req.user._id, bookingType: 'guest' })
    .populate('event', 'title startDate bannerImage location')
    .sort({ createdAt: -1 });
    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.log("err = ", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// bookingController.js
exports.getBookingsByMemberId = async (req, res) => {
  try {
    const { memberId } = req.params; // e.g., "0001", "12345"

    if (!memberId?.trim()) {
      return res.status(400).json({ success: false, message: "Member ID required" });
    }

    // Step 1: Find the User (SRS_User) by memberId (custom field)
    const member = await User.findOne({ memberId: memberId.trim() });
    // Or if the field is named differently, try:
    // const member = await User.findOne({ memberId: memberId.trim() });
    // OR
    // const member = await User.findOne({ membershipId: memberId.trim() });

    if (!member) {
      return res.status(404).json({ 
        success: false, 
        message: "Member not found in system" 
      });
    }

    // Step 2: Now find bookings where `user` field = member's _id
    const bookings = await Booking.find({ user: member._id })
      .populate('event', 'title mapsUrl startDate')
      .sort({ bookingDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      memberName: member.fullName || member.name,
      memberId: memberId,
      totalBookings: bookings.length,
      data: bookings
    });

  } catch (error) {
    console.error("getBookingsByMemberId error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: error.message 
    });
  }
};