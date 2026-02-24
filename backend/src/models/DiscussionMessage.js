const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const discussionMessageSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionMessage' },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    isAnnouncement: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    reactions: [reactionSchema],
  },
  { timestamps: true }
);

discussionMessageSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('DiscussionMessage', discussionMessageSchema);
