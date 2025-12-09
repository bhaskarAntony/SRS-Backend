const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { validateBooking, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

router.get('/member-requests', authenticate, bookingController.getMemberRequests);

router.post('/', authenticate, bookingController.createBooking);
router.get('/user', authenticate, bookingController.getUserBookings);
router.get('/:id', authenticate, bookingController.getBookingById);
router.get('/member/:memberId', authenticate, bookingController.getBookingsByMemberId);
router.put('/:id/cancel', authenticate, bookingController.cancelBooking);
router.get('/:id/ticket', authenticate, bookingController.downloadTicket);
router.post('/scan-qr', authenticate, bookingController.scanQRCode);
router.post('/payment/initiate', authenticate, bookingController.initiatePayment);
router.post('/payment/verify', bookingController.verifyPayment);

router.get('/admin/all', authorizeAdmin, bookingController.getAllBookings);
router.post('/admin/manual', authorizeAdmin, bookingController.createManualBooking);
router.put('/:id/status', authorizeAdmin, bookingController.updateBookingStatus);

router.post('/guest-request', bookingController.createGuestRequest);
router.get('/guest-status/:bookingId', bookingController.getGuestBookingStatus);
router.post('/approve-request/:id', authenticate, bookingController.approveGuestRequest);
router.post('/reject-request/:id', authenticate, bookingController.rejectGuestRequest);

module.exports = router;