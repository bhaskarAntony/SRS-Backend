const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const excelService = require('../services/excelService');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const QRCode = require('qrcode');

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalMembers,
      totalEvents,
      totalBookings,
      recentUsers,
      recentBookings,
      totalRevenue,
      totalTicketsByType,
      mealSummary,
      totalDiscounts,
      amountCollected,
      paymentBreakdown,
      totalTicketsBooked,
  totalTicketsScanned,
  totalTicketsRemaining
    ] = await Promise.all([
      User.countDocuments({ role: 'user', isActive: true }),
      User.countDocuments({ role: 'member', isActive: true }),
      Event.countDocuments({ isActive: true }),
      Booking.countDocuments(),
      User.find({ role: { $in: ['user', 'member'] }, isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('firstName lastName email role createdAt'),
      Booking.find()
        .populate('event', 'title')
        .populate('user', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5),
      Booking.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Booking.aggregate([
        { $group: { _id: null, 
          memberTickets: { $sum: '$memberTicketCount' },
          guestTickets: { $sum: '$guestTicketCount' },
          kidTickets: { $sum: '$kidTicketCount' }
        }}
      ]),
      Booking.aggregate([
        { $group: { _id: null, 
          veg: { $sum: { $add: ['$memberVegCount', '$guestVegCount', '$kidVegCount'] } },
          nonVeg: { $sum: { $add: ['$memberNonVegCount', '$guestNonVegCount', '$kidNonVegCount'] } }
        }}
      ]),
      Booking.aggregate([
        { $group: { _id: null, total: { $sum: '$discountAmount' } } }
      ]),
      Booking.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } } // NEW: Collected amount
      ]),
      Booking.aggregate([
        { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
      ]),
      // ... existing promises ...

// New: Total tickets booked (sum of seatCount)
 Booking.aggregate([
  { $group: { _id: null, total: { $sum: '$seatCount' } } }
]),

// New: Total tickets scanned (sum of qrScanCount)
 Booking.aggregate([
  { $group: { _id: null, total: { $sum: '$qrScanCount' } } }
]),

// New: Total tickets remaining (sum of remainingScans, which is qrScanLimit - qrScanCount)
Booking.aggregate([
  { $project: { remaining: { $subtract: ['$qrScanLimit', '$qrScanCount'] } } },
  { $group: { _id: null, total: { $sum: '$remaining' } } }
]),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalTicketsBooked: totalTicketsBooked[0]?.total || 0,
totalTicketsScanned: totalTicketsScanned[0]?.total || 0,
totalTicketsRemaining: Math.max(0, totalTicketsRemaining[0]?.total || 0),
          totalUsers,
          totalMembers,
          totalEvents,
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          totalTicketsByType: totalTicketsByType[0] || { memberTickets: 0, guestTickets: 0, kidTickets: 0 },
          mealSummary: mealSummary[0] || { veg: 0, nonVeg: 0 },
          totalDiscounts: totalDiscounts[0]?.total || 0,
          amountCollected: amountCollected[0]?.total || 0,
          paymentBreakdown: paymentBreakdown
        },
        recentUsers,
        recentBookings
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

// Get revenue chart data
exports.getRevenueChart = async (req, res) => {
  try {
    const { period = '7d' } = req.query;
   
    let startDate;
    let groupBy;
   
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        break;
      case '12m':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    }
    const revenueData = await Booking.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.status(200).json({
      status: 'success',
      data: revenueData
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch revenue data',
      error: error.message
    });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role = 'user' } = req.query;
    const filter = { role, isActive: true };
   
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }
    const users = await User.find(filter)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await User.countDocuments(filter);
    res.status(200).json({
      status: 'success',
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const userData = {
      ...req.body,
      role: 'user'
    };
    const user = await User.create(userData);
    user.password = undefined;
    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshTokens');
   
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    res.status(200).json({
      status: 'success',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// Import users
exports.importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Excel file is required'
      });
    }
    const users = await excelService.parseUsersExcel(req.file.buffer);
    const results = await excelService.importUsers(users);
    res.status(200).json({
      status: 'success',
      message: 'Users imported successfully',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to import users',
      error: error.message
    });
  }
};

// Export users
exports.exportUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user', isActive: true })
      .select('firstName lastName email phone createdAt')
      .sort({ createdAt: -1 });
    const excelBuffer = await excelService.exportUsers(users);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to export users',
      error: error.message
    });
  }
};

// Get all members
exports.getAllMembers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, membershipTier } = req.query;
    const filter = { role: 'member', isActive: true };
   
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') }
      ];
    }
    if (membershipTier) {
      filter.membershipTier = membershipTier;
    }
    const members = await User.find(filter)
      .select('-password -refreshTokens')
      .populate('sponsoredBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await User.countDocuments(filter);
    res.status(200).json({
      status: 'success',
      data: members,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalMembers: total
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch members',
      error: error.message
    });
  }
};

// Create member
exports.createMember = async (req, res) => {
  try {
   
    const password = `${firstName.toLowerCase()}@${memberId.toLowerCase()}`;
    const fakeEmail = `${firstName.toLowerCase()}.${memberId.toLowerCase()}@membersrs.com`;
    const phone = `+91${memberId.replace(/[^0-9]/g, '')}`;
    
        // Create User
        const newMember = new  User({
          ...req.body,
          email: fakeEmail,
          phone,
          password,
          role: 'member',
          isActive: true
        });
        await newMember.save()
    
   
    // await emailService.sendMemberCredentials(member.email, {
    //   firstName: member.firstName,
    //   email: member.email,
    //   password: tempPassword,
    //   loginUrl: `${process.env.FRONTEND_URL}/login`
    // });
    // member.password = undefined;
    res.status(201).json({
      status: 'success',
      message: 'Member created successfully and credentials sent via email',
      data: member
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create member',
      error: error.message
    });
  }
};

// Get member by ID
exports.getMemberById = async (req, res) => {
  console.log(req.params.id);
  try {
    const member = await User.findOne({memberId:req.params.id})
      .select('-password -refreshTokens')
      .populate('sponsoredBy', 'firstName lastName email');
   console.log(member);
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    res.status(200).json({
      status: 'success',
      data: member
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch member',
      error: error.message
    });
  }
};

// Update member
exports.updateMember = async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password -refreshTokens');
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Member updated successfully',
      data: member
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update member',
      error: error.message
    });
  }
};

// Delete member
exports.deleteMember = async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Member deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete member',
      error: error.message
    });
  }
};

// Deactivate member
exports.deactivateMember = async (req, res) => {
  try {
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!member || member.role !== 'member') {
      return res.status(404).json({
        status: 'error',
        message: 'Member not found'
      });
    }
    res.status(200).json({
      status: 'success',
      message: 'Member deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to deactivate member',
      error: error.message
    });
  }
};

// Import members
exports.importMembers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Excel file is required'
      });
    }
    const members = await excelService.parseMembersExcel(req.file.buffer);
    const results = await excelService.importMembers(members);
    res.status(200).json({
      status: 'success',
      message: 'Members imported successfully',
      data: results
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to import members',
      error: error.message
    });
  }
};

// Export members
exports.exportMembers = async (req, res) => {
  try {
    const members = await User.find({ role: 'member', isActive: true })
      .select('firstName lastName email phone membershipTier membershipDate loyaltyPoints createdAt')
      .populate('sponsoredBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    const excelBuffer = await excelService.exportMembers(members);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=members.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to export members',
      error: error.message
    });
  }
};

// Get member template
exports.getMemberTemplate = async (req, res) => {
  try {
    const templateBuffer = await excelService.getMemberTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=member-template.xlsx');
    res.send(templateBuffer);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate template',
      error: error.message
    });
  }
};

// NEW: Create Offline Booking
exports.createOfflineBooking = async (req, res) => {
  try {
    const { eventId, memberId, memberName, contactNumber, notes, memberTicketCount, guestTicketCount, kidTicketCount, memberVegCount, memberNonVegCount, guestVegCount, guestNonVegCount, kidVegCount, kidNonVegCount, attendeeNamesJson, discountCode, paymentStatus, amountPaid, utrNumber, paymentMode } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const member = await User.findOne({ memberId: memberId.toUpperCase(), role: 'member' });
    if (!member && (memberTicketCount > 0 || guestTicketCount > 0)) return res.status(400).json({ message: 'Invalid Member ID for Member/Guest tickets' });

    // Calculate totals
    const seatCount = memberTicketCount + guestTicketCount + kidTicketCount;
    const grossAmount = (memberTicketCount * 1500) + (guestTicketCount * 2000) + (kidTicketCount * 850);

    // Discount
    let discountPercent = 0;
    if (discountCode) {
      const validCodes = {
        'Discount52026': 5,
        'Discount102026': 10,
        'Discount152026': 15
      };
      discountPercent = validCodes[discountCode] || 0;
    }
    const discountAmount = Math.round(grossAmount * (discountPercent / 100));
    const finalAmount = grossAmount - discountAmount;

    // Validate payment
    if (paymentStatus === 'paid') {
      if (!utrNumber) return res.status(400).json({ message: 'UTR required for Paid status' });
      if (amountPaid !== finalAmount) return res.status(400).json({ message: 'Amount Paid must match Final Amount' });
    } else {
      amountPaid = 0;
    }
    

    // Validate meal counts
    const totalMeals = memberVegCount + memberNonVegCount + guestVegCount + guestNonVegCount + kidVegCount + kidNonVegCount;
    if (totalMeals !== seatCount) return res.status(400).json({ message: 'Total meal count must match ticket count' });

    // Generate QR
    const qrCode = crypto.randomBytes(16).toString('hex');
    const qrCodeImage = await QRCode.toDataURL(qrCode);
 const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookingId = `SRS${timestamp}${random}`;
    const booking = await Booking.create({
      event: eventId,
      user: member ? member._id : null,
      bookingType: 'offline', // NEW enum value? Add to model if needed
      seatCount,
      eventName:event.title,
      bookingId,
      unitPrice: 0, // Not applicable for mixed
      grossAmount,
      discountCode,
      discountPercent,
      discountAmount,
      finalAmount,
      totalAmount: finalAmount,
      memberTicketCount,
      guestTicketCount,
      kidTicketCount,
      memberVegCount,
      memberNonVegCount,
      guestVegCount,
      guestNonVegCount,
      kidVegCount,
      kidNonVegCount,
      attendeeNamesJson,
      status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
      paymentStatus:'completed',
      paymentMethod: paymentMode,
      paymentDetails: {
        utrNumber,
        transactionId: utrNumber, // Use UTR as transaction ID for offline
        paymentDate: new Date(),
        amountPaid
      },
      qrCode,
      qrCodeImage,
      qrScanLimit: seatCount,
      notes,
      createdBy: req.user._id,
      memberName,
      contactNumber
    });

    await event.updateBookedSeats(seatCount);

    res.status(201).json({
      status: 'success',
      message: 'Offline booking created',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create offline booking',
      error: error.message
    });
  }
};

// NEW: Get Offline Bookings List
exports.getOfflineBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, startDate, endDate, eventId, memberId, utrNumber, paymentStatus, discountCode } = req.query;

    const filter = { bookingType: 'offline' };
    if (startDate) filter.bookingDate = { $gte: new Date(startDate) };
    if (endDate) filter.bookingDate = { $lte: new Date(endDate) };
    if (eventId) filter.event = eventId;
    if (memberId) filter.memberIdInput = memberId;
    if (utrNumber) filter['paymentDetails.utrNumber'] = utrNumber;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (discountCode) filter.discountCode = discountCode;

    const bookings = await Booking.find(filter)
      .populate('event', 'title startDate')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Booking.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: bookings,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBookings: total
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch offline bookings',
      error: error.message
    });
  }
};

exports.deleteOfflineBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if booking exists
    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        status: "failed",
        message: "Booking not found"
      });
    }

    // Delete booking
    const deletedBooking = await Booking.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Offline booking deleted successfully",
      deletedData: deletedBooking,
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to delete offline booking",
      error: error.message,
    });
  }
};


// NEW: Edit Offline Booking
exports.editOfflineBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.bookingType !== 'offline') return res.status(404).json({ message: 'Booking not found' });

    const updatedData = req.body;
    // Recalculate totals if ticket/meals changed
    if (updatedData.memberTicketCount !== undefined) {
      const event = await Event.findById(booking.event);
      const grossAmount = (updatedData.memberTicketCount * event.memberPrice) + (updatedData.guestTicketCount * event.guestPrice) + (updatedData.kidTicketCount * event.kidPrice);
      updatedData.grossAmount = grossAmount;
      updatedData.discountAmount = Math.round(grossAmount * (updatedData.discountPercent / 100));
      updatedData.finalAmount = grossAmount - updatedData.discountAmount;
      updatedData.totalAmount = updatedData.finalAmount;
      updatedData.seatCount = updatedData.memberTicketCount + updatedData.guestTicketCount + updatedData.kidTicketCount;
      updatedData.qrScanLimit = updatedData.seatCount;
      // Adjust event booked seats if changed
      const seatDiff = updatedData.seatCount - booking.seatCount;
      await event.updateBookedSeats(seatDiff);
    }

    updatedData.lastModifiedBy = req.user._id;
    const updatedBooking = await Booking.findByIdAndUpdate(req.params.id, updatedData, { new: true, runValidators: true });

    res.status(200).json({
      status: 'success',
      message: 'Booking updated',
      data: updatedBooking
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update booking',
      error: error.message
    });
  }
};

// NEW: Send QR via WhatsApp (frontend calls this, but backend can generate link)
exports.getWhatsAppShareLink = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const summary = `Your SRS Booking:
Booking ID: ${booking.bookingId}
Member: ${booking.memberName || 'N/A'}
Tickets: Member ${booking.memberTicketCount}, Guest ${booking.guestTicketCount}, Kid ${booking.kidTicketCount}
Meals: Veg ${booking.memberVegCount + booking.guestVegCount + booking.kidVegCount}, Non-Veg ${booking.memberNonVegCount + booking.guestNonVegCount + booking.kidNonVegCount}
Amount: ₹${booking.finalAmount}
Payment: ${booking.paymentStatus.toUpperCase()} ${booking.paymentDetails.utrNumber ? `UTR: ${booking.paymentDetails.utrNumber}` : ''}

Event: ${booking.event.title}
Date: ${new Date(booking.event.startDate).toLocaleDateString()}

Scan QR at venue for entry.`;

    const encodedSummary = encodeURIComponent(summary);
    const link = `https://wa.me/${booking.contactNumber}?text=${encodedSummary}`;

    res.json({
      status: 'success',
      data: { link }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate share link',
      error: error.message
    });
  }
};

// NEW: CSV Export for Bookings
exports.exportBookingsCSV = async (req, res) => {
  try {
    const bookings = await Booking.find({ bookingType: 'offline' })
      .populate('event', 'title')
      .sort({ createdAt: -1 });

    const csvData = bookings.map(b => ({
      bookingId: b.bookingId,
      event: b.event.title,
      memberId: b.memberIdInput,
      memberName: b.memberName || '',
      contactNumber: b.contactNumber || '',
      memberTickets: b.memberTicketCount,
      guestTickets: b.guestTicketCount,
      kidTickets: b.kidTicketCount,
      vegMeals: b.memberVegCount + b.guestVegCount + b.kidVegCount,
      nonVegMeals: b.memberNonVegCount + b.guestNonVegCount + b.kidNonVegCount,
      grossAmount: b.grossAmount,
      discountCode: b.discountCode || '',
      discountAmount: b.discountAmount,
      finalAmount: b.finalAmount,
      paymentStatus: b.paymentStatus,
      utrNumber: b.paymentDetails.utrNumber || '',
      paymentMode: b.paymentMethod,
      paymentDate: b.paymentDetails.paymentDate,
      createdAt: b.createdAt
    }));

    // Use json2csv or similar to generate CSV
    const { Parser } = require('json2csv');
    const parser = new Parser();
    const csv = parser.parse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to export bookings',
      error: error.message
    });
  }
};