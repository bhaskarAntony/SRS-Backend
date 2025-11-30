const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { 
  validatePasswordChange,
  handleValidationErrors 
} = require('../middleware/validation');

const router = express.Router();


router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);

router.post('/forgot-password', 
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  handleValidationErrors,
  authController.forgotPassword
);
router.post('/reset-password', 
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  authController.resetPassword
);


// router.use(authenticate);

router.put('/profile', authController.updateProfile);
router.put('/change-password', authController.changePassword);


module.exports = router;