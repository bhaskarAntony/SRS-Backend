const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();


router.use(authenticate);

router.get('/favorites', userController.getFavorites);
router.post('/favorites/:eventId', userController.addToFavorites);
router.delete('/favorites/:eventId', userController.removeFromFavorites);

router.get('/cart', userController.getCart);
router.post('/cart', userController.addToCart);
router.put('/cart/:eventId', userController.updateCartItem);
router.delete('/cart/:eventId', userController.removeFromCart);
router.delete('/cart', userController.clearCart);

module.exports = router;