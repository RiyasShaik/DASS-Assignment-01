const express = require('express');
const { body } = require('express-validator');
const {
  browseEvents,
  getTrendingEvents,
  getEventDetails,
  getOrganizerPublicProfile,
  listOrganizers,
  getDiscussionMessages,
  postDiscussionMessage,
  deleteDiscussionMessage,
  pinDiscussionMessage,
  reactToMessage,
  getTicketCalendarLinks,
  downloadTicketICS,
} = require('../controllers/event.controller');
const validate = require('../middleware/validation.middleware');

const router = express.Router();

router.get('/', browseEvents);
router.get('/trending', getTrendingEvents);
router.get('/organizers', listOrganizers);
router.get('/organizers/:organizerId', getOrganizerPublicProfile);
router.get('/tickets/:ticketCode/calendar-links', getTicketCalendarLinks);
router.get('/tickets/:ticketCode/calendar.ics', downloadTicketICS);

router.get('/:eventId', getEventDetails);

router.get('/:eventId/discussion', getDiscussionMessages);
router.post(
  '/:eventId/discussion',
  [
    body('content').isString().isLength({ min: 1, max: 2000 }),
    body('parentId').optional().isMongoId(),
    body('isAnnouncement').optional().isBoolean(),
    validate,
  ],
  postDiscussionMessage
);
router.delete('/:eventId/discussion/:messageId', deleteDiscussionMessage);
router.patch('/:eventId/discussion/:messageId/pin', pinDiscussionMessage);
router.post(
  '/:eventId/discussion/:messageId/react',
  [body('emoji').isString().isLength({ min: 1, max: 8 }), validate],
  reactToMessage
);

module.exports = router;
