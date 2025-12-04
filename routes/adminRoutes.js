const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdmin);

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/revenue', adminController.getRevenueChart);

router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/import', upload.single('file'), adminController.importUsers);
router.get('/users/export', adminController.exportUsers);

router.get('/members', adminController.getAllMembers);
router.post('/members', adminController.createMember);
router.get('/members/:id', adminController.getMemberById);
router.put('/members/:id', adminController.updateMember);
router.delete('/members/:id', adminController.deleteMember);
router.put('/members/:id/deactivate', adminController.deactivateMember);
router.post('/members/import', upload.single('file'), adminController.importMembers);
router.get('/members/export', adminController.exportMembers);
router.get('/members/template', adminController.getMemberTemplate);

// NEW: Offline Bookings Routes
router.post('/offline-bookings', adminController.createOfflineBooking);
router.get('/offline-bookings', adminController.getOfflineBookings);
router.put('/offline-bookings/:id', adminController.editOfflineBooking);
router.get('/offline-bookings/export', adminController.exportBookingsCSV);
router.get('/offline-bookings/whatsapp/:id', adminController.getWhatsAppShareLink);

module.exports = router;