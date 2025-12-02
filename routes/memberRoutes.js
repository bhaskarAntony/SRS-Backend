const express = require('express');
const router = express.Router();
const { addMember, getAllMembers, memberLogin } = require('../controllers/memberController');
const { authorizeAdmin, authenticate } = require('../middleware/auth');

router.post('/add', authenticate, authorizeAdmin, addMember);

router.get('/', authenticate, authorizeAdmin, getAllMembers);

router.post('/login', memberLogin);

module.exports = router;
