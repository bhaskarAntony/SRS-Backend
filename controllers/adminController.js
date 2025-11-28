const User = require('../models/User');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const excelService = require('../services/excelService');
const emailService = require('../services/emailService');
const crypto = require('crypto');

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
      totalRevenue
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
      ])
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalUsers,
          totalMembers,
          totalEvents,
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0
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

    const users = await User.find()
      // .select('-password -refreshTokens')
      // .sort({ createdAt: -1 })
      // .limit(limit * 1)
      // .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      data: users,
      // pagination: {
      //   currentPage: parseInt(page),
      //   totalPages: Math.ceil(total / limit),
      //   totalUsers: total
      // }
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
    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    
    const memberData = {
      ...req.body,
      role: 'member',
      password: tempPassword,
      membershipDate: new Date()
    };

    const member = await User.create(memberData);
    
    // Send login credentials via email
    await emailService.sendMemberCredentials(member.email, {
      firstName: member.firstName,
      email: member.email,
      password: tempPassword,
      loginUrl: `${process.env.FRONTEND_URL}/login`
    });

    member.password = undefined;

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
  try {
    const member = await User.findById(req.params.id)
      .select('-password -refreshTokens')
      .populate('sponsoredBy', 'firstName lastName email');
    
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