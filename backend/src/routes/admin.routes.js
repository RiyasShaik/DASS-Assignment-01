const express = require('express');
const { body } = require('express-validator');
const {
  getDashboard,
  createOrganizer,
  listOrganizers,
  updateOrganizerStatus,
  listPasswordResetRequests,
  handlePasswordResetRequest,
} = require('../controllers/admin.controller');
const validate = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/dashboard', getDashboard);

router.post(
  '/organizers',
  [
    body('organizerName').isString().isLength({ min: 2 }),
    body('category').isString().isLength({ min: 2 }),
    body('description').isString().isLength({ min: 5 }),
    body('contactEmail').isEmail(),
    body('contactNumber').optional().isString(),
    validate,
  ],
  createOrganizer
);

router.get('/organizers', listOrganizers);
router.patch(
  '/organizers/:organizerId/status',
  [body('action').isIn(['disable', 'enable', 'archive', 'delete']), validate],
  updateOrganizerStatus
);

router.get('/password-reset-requests', listPasswordResetRequests);
router.patch(
  '/password-reset-requests/:requestId',
  [body('decision').isIn(['approved', 'rejected']), body('adminComment').optional().isString(), validate],
  handlePasswordResetRequest
);

module.exports = router;
