const express = require('express');
const router = express.Router();
const { addMember, getAllMembers, memberLogin, importMembersController } = require('../controllers/memberController');
const { authorizeAdmin, authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
router.post('/add', authenticate, authorizeAdmin, addMember);

router.get('/', authenticate, authorizeAdmin, getAllMembers);

router.post('/login', memberLogin);
router.post('/import-members', upload.single('file'), importMembersController);

module.exports = router;
