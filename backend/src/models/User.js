const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, required: function requiredFirstName() { return this.role === 'participant'; } },
    lastName: { type: String, trim: true, required: function requiredLastName() { return this.role === 'participant'; } },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['participant', 'organizer', 'admin'], required: true, immutable: true },

    participantType: {
      type: String,
      enum: ['iiit', 'non_iiit'],
      required: function requiredParticipantType() {
        return this.role === 'participant';
      },
      immutable: true,
    },
    collegeName: {
      type: String,
      trim: true,
      required: function requiredCollegeName() {
        return this.role === 'participant';
      },
    },
    contactNumber: {
      type: String,
      trim: true,
      required: function requiredContactNumber() {
        return this.role === 'participant';
      },
    },
    interests: [{ type: String, trim: true }],
    followedOrganizers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    organizerName: {
      type: String,
      trim: true,
      required: function requiredOrganizerName() {
        return this.role === 'organizer';
      },
    },
    category: {
      type: String,
      trim: true,
      required: function requiredCategory() {
        return this.role === 'organizer';
      },
    },
    description: {
      type: String,
      trim: true,
      required: function requiredDescription() {
        return this.role === 'organizer';
      },
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: function requiredContactEmail() {
        return this.role === 'organizer';
      },
    },
    discordWebhook: { type: String, trim: true },

    isDisabled: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    createdByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
