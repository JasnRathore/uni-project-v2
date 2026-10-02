const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/auth/login', authController.login);
router.post('/signup', authController.signup);
router.post('/student/signup', authController.studentSignup);
router.post('/account/reactivate', authController.reactivateAccount);

module.exports = router;
