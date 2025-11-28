const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User registration validation
exports.validateUserRegistration = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// User login validation
exports.validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Event creation validation
exports.validateEventCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('category')
    .isIn(['Conference', 'Workshop', 'Seminar', 'Concert', 'Sports', 'Exhibition', 'Other'])
    .withMessage('Please select a valid category'),
  body('startDate')
    .isISO8601()
    .isAfter()
    .withMessage('Start date must be a future date'),
  body('endDate')
    .isISO8601()
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('location')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Location must be between 5 and 200 characters'),
  body('userPrice')
    .isFloat({ min: 0 })
    .withMessage('User price must be a positive number'),
  body('memberPrice')
    .isFloat({ min: 0 })
    .withMessage('Member price must be a positive number'),
  body('guestPrice')
    .isFloat({ min: 0 })
    .withMessage('Guest price must be a positive number'),
  body('maxCapacity')
    .isInt({ min: 1 })
    .withMessage('Maximum capacity must be at least 1'),
  body('bannerImage')
    .isURL()
    .withMessage('Banner image must be a valid URL')
];

// Booking validation
exports.validateBooking = [
  body('eventId')
    .isMongoId()
    .withMessage('Please provide a valid event ID'),
  body('seatCount')
    .isInt({ min: 1, max: 10 })
    .withMessage('Seat count must be between 1 and 10'),
  body('bookingType')
    .isIn(['user', 'member', 'guest'])
    .withMessage('Please select a valid booking type')
];

// Password change validation
exports.validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
];