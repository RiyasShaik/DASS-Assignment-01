const express = require('express');
const { body } = require('express-validator');
const {
  getDashboard,
  getProfile,
  updateProfile,
  createEvent,
  updateEvent,
  publishEvent,
  getEventDetails,
  exportParticipantsCsv,
  reviewMerchPayment,
  listPendingMerchOrders,
  scanTicket,
  manualAttendanceOverride,
  getAttendanceDashboard,
  exportAttendanceCsv,
  requestPasswordReset,
  myPasswordResetRequests,
} = require('../controllers/organizer.controller');
const validate = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/dashboard', getDashboard);
router.get('/profile', getProfile);
router.patch(
  '/profile',
  [
    body('organizerName').optional().isString().trim().isLength({ min: 1 }),
    body('category').optional().isString().trim().isLength({ min: 1 }),
    body('description').optional().isString().trim().isLength({ min: 1 }),
    body('contactEmail').optional().isEmail(),
    body('contactNumber').optional().isString().trim().isLength({ min: 1 }),
    body('discordWebhook').optional().isString(),
    validate,
  ],
  updateProfile
);

router.post('/events', createEvent);
router.put('/events/:eventId', updateEvent);
router.patch('/events/:eventId/publish', publishEvent);
router.get('/events/:eventId', getEventDetails);
router.get('/events/:eventId/participants/export', exportParticipantsCsv);
router.get('/events/:eventId/orders/pending', listPendingMerchOrders);
router.patch(
  '/events/:eventId/orders/:registrationId/review',
  [body('decision').isIn(['approved', 'rejected']), body('comment').optional().isString(), validate],
  reviewMerchPayment
);

router.post(
  '/events/:eventId/attendance/scan',
  [body('ticketCode').isString().isLength({ min: 1 }), body('method').optional().isIn(['camera', 'file', 'manual']), validate],
  scanTicket
);
router.post(
  '/events/:eventId/attendance/override',
  [body('registrationId').isString().isLength({ min: 1 }), body('reason').optional().isString(), validate],
  manualAttendanceOverride
);
router.get('/events/:eventId/attendance', getAttendanceDashboard);
router.get('/events/:eventId/attendance/export', exportAttendanceCsv);

router.post(
  '/password-reset-requests',
  [body('reason').isString().isLength({ min: 5 }), validate],
  requestPasswordReset
);
router.get('/password-reset-requests', myPasswordResetRequests);

module.exports = router;
