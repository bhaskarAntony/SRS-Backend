const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, authorizeAdmin } = require('./authController');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || "shhdhdhdhdhhdhd", { expiresIn: '7d' });
};

exports.addMember = async (req, res) => {
  try {
    const { firstName, lastName, memberId } = req.body;

    if (!firstName || !memberId) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'First name and Member ID required' 
      });
    }

    const existingMember = await User.findOne({ 
      memberId: memberId.toUpperCase(), 
      role: 'member' 
    });
    if (existingMember) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Member ID already exists' 
      });
    }

    const password = `${firstName.toLowerCase()}@${memberId.toLowerCase()}`;
    
    const fakeEmail = `${firstName.toLowerCase()}.${memberId.toLowerCase()}@member.srs`;

    const member = await User.create({ 
      firstName,
      lastName: lastName || '',
      email: fakeEmail,
      phone: `+91${memberId.replace(/[^0-9]/g, '')}`,
      password,
      role: 'member',
      memberId: memberId.toUpperCase(),
      isActive: true
    });

    member.password = undefined;

    res.status(201).json({
      status: 'success',
      message: 'Member created successfully',
      data: { 
        member,
        loginInfo: {
          memberId: member.memberId,
          email: fakeEmail,
          password, 
          loginUrl: `${process.env.FRONTEND_URL}/auth?tab=member`
        }
      }
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.getAllMembers = async (req, res) => {
  try {
    const members = await User.find({ role: 'member' })
      .select('-password -resetPasswordToken -resetPasswordExpire -refreshTokens')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: members.length,
      data: { members }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

exports.memberLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Member ID/Email and password required' 
      });
    }

    const user = await User.findOne({ 
      $or: [
        { memberId: identifier.toUpperCase() },
        { email: identifier.toLowerCase() }
      ],
      role: 'member'
    }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid Member ID, email, or password' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Member account is deactivated' 
      });
    }

    const token = generateToken(user._id);
    
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    user.password = undefined;

    res.status(200).json({
      status: 'success',
      message: 'Member login successful',
      data: { 
        user, 
        token 
      }
    });
  } catch (error) {
    console.error('Member login error:', error);
    res.status(500).json({ status: 'error', message: 'Login failed' });
  }
};
