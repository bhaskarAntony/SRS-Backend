const express = require('express');
const eventController = require('../controllers/eventController');
const { authenticate, authorizeAdmin, optionalAuth } = require('../middleware/auth');
const { validateEventCreation, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();


router.get('/', optionalAuth, eventController.getAllEvents);
router.get('/featured', eventController.getFeaturedEvents);
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/search', eventController.searchEvents);
router.get('/:id', optionalAuth, eventController.getEventById);


router.use(authenticate);

router.post('/:id/favorite', eventController.toggleFavorite);


router.use(authorizeAdmin);

router.post('/',  eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);
router.patch('/:id/status', eventController.updateEventStatus);

module.exports = router;