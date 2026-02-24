const express = require('express');
const { body } = require('express-validator');
const {
  getDashboard,
  getProfile,
  updateProfile,
  updatePreferences,
  followOrganizer,
  unfollowOrganizer,
  registerNormalEvent,
  createMerchOrder,
  getMyRegistrations,
  getTicket,
} = require('../controllers/participant.controller');
const { uploadPaymentProof, uploadDynamicFormFiles } = require('../middleware/upload.middleware');
const validate = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.patch(
  '/profile',
  [
    body('firstName').optional().isString().trim().isLength({ min: 1 }),
    body('lastName').optional().isString().trim().isLength({ min: 1 }),
    body('contactNumber').optional().isString().trim().isLength({ min: 1 }),
    body('collegeName').optional().isString().trim().isLength({ min: 1 }),
    body('interests').optional().isArray(),
    body('interests.*').optional().isString().trim().isLength({ min: 1 }),
    validate,
  ],
  updateProfile
);

router.patch(
  '/preferences',
  [
    body('interests').optional().isArray(),
    body('interests.*').optional().isString().trim().isLength({ min: 1 }),
    body('followedOrganizers').optional().isArray(),
    body('followedOrganizers.*').optional().isMongoId(),
    validate,
  ],
  updatePreferences
);

router.post('/organizers/:organizerId/follow', followOrganizer);
router.delete('/organizers/:organizerId/follow', unfollowOrganizer);

router.get('/registrations', getMyRegistrations);
router.get('/tickets/:ticketCode', getTicket);

router.post('/events/:eventId/register', uploadDynamicFormFiles, registerNormalEvent);
router.post('/events/:eventId/merch-order', uploadPaymentProof, createMerchOrder);

module.exports = router;
