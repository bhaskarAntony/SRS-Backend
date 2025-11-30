const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate user
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token received:', token); // You saw the correct token

    // ← THIS WAS THE BUG! ←
    const decoded = jwt.verify(token, "shhdhdhdhdhhdhd"); // ← FIXED!
    console.log(decoded)
    const user = await User.findById(decoded.id);
    if (!user) {
    console.log("no user")
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verify Error:', err.message);
    res.status(401).json({ message: 'Token is not valid or expired' });
  }
};

// Authorize admin
exports.authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      status: 'error',
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// Authorize member or admin
exports.authorizeMember = (req, res, next) => {
  if (req.user && (req.user.role === 'member' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({
      status: 'error',
      message: 'Access denied. Member or admin privileges required.'
    });
  }
};

// Optional authentication (for public routes that can benefit from user context)
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, "shhdhdhdhdhhdhd");
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    
    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};