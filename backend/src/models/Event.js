const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema(
  {
    fieldId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'email', 'dropdown', 'checkbox', 'radio', 'file', 'date'],
      required: true,
    },
    options: [{ type: String, trim: true }],
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const merchandiseVariantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    price: { type: Number, min: 0, required: true },
    stock: { type: Number, min: 0, required: true },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    type: { type: String, enum: ['normal', 'merchandise'], required: true },
    category: { type: String, trim: true, default: '' },
    venue: { type: String, trim: true, default: '' },
    eligibility: { type: String, enum: ['iiit', 'non_iiit', 'all'], default: 'all' },
    registrationDeadline: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    registrationLimit: { type: Number, min: 1, default: 100 },
    registrationFee: { type: Number, min: 0, default: 0 },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tags: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: ['draft', 'published', 'ongoing', 'completed', 'closed'],
      default: 'draft',
    },

    customFormFields: [customFieldSchema],

    merchandiseDetails: {
      variants: [merchandiseVariantSchema],
      purchaseLimitPerParticipant: { type: Number, min: 1, default: 1 },
    },

    totalRegistrations: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalAttendance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

eventSchema.index({ name: 'text', description: 'text', tags: 'text' });
eventSchema.index({ organizerId: 1, status: 1 });
eventSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
