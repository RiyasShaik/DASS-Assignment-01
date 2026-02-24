const express = require('express');
const { body } = require('express-validator');
const {
  registerParticipant,
  login,
  getCurrentUser,
  changePassword,
  logout,
  requestOrganizerPasswordReset,
} = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validation.middleware');

const router = express.Router();

router.post(
  '/register/participant',
  [
    body('firstName').isString().trim().isLength({ min: 1 }),
    body('lastName').isString().trim().isLength({ min: 1 }),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('participantType').isIn(['iiit', 'non_iiit']),
    body('collegeName').isString().trim().isLength({ min: 1 }),
    body('contactNumber').isString().trim().isLength({ min: 1 }),
    validate,
  ],
  registerParticipant
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().isLength({ min: 1 }), validate],
  login
);

router.get('/me', auth, getCurrentUser);

router.post(
  '/change-password',
  auth,
  [
    body('currentPassword').isString().isLength({ min: 1 }),
    body('newPassword').isString().isLength({ min: 8 }),
    validate,
  ],
  changePassword
);

router.post('/logout', auth, logout);

router.post(
  '/organizer-reset-request',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('reason').isString().trim().isLength({ min: 1 }).withMessage('Reason is required'),
    validate,
  ],
  requestOrganizerPasswordReset
);

module.exports = router;
