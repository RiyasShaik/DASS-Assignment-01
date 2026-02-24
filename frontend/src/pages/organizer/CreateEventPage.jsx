import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEventDraft } from '../../api/organizer';

const emptyField = {
  fieldId: '',
  label: '',
  type: 'text',
  required: false,
  order: 0,
  optionsRaw: '',
};

const emptyVariant = {
  sku: '',
  name: '',
  size: '',
  color: '',
  price: 0,
  stock: 0,
};

const optionFieldTypes = new Set(['dropdown', 'checkbox', 'radio']);

function CreateEventPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'normal',
    category: '',
    venue: '',
    eligibility: 'all',
    registrationDeadline: '',
    startDate: '',
    endDate: '',
    registrationLimit: 100,
    registrationFee: 0,
    tagsRaw: '',
    customFormFields: [],
    merchandiseDetails: {
      variants: [emptyVariant],
      purchaseLimitPerParticipant: 1,
    },
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const addCustomField = () => {
    setForm((prev) => ({
      ...prev,
      customFormFields: [
        ...prev.customFormFields,
        {
          ...emptyField,
          order: prev.customFormFields.length,
        },
      ],
    }));
  };

  const updateCustomField = (index, patch) => {
    setForm((prev) => {
      const fields = [...prev.customFormFields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, customFormFields: fields };
    });
  };

  const moveCustomField = (index, direction) => {
    setForm((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.customFormFields.length) return prev;

      const fields = [...prev.customFormFields];
      const current = fields[index];
      fields[index] = fields[targetIndex];
      fields[targetIndex] = current;

      return {
        ...prev,
        customFormFields: fields.map((field, idx) => ({ ...field, order: idx })),
      };
    });
  };

  const removeCustomField = (index) => {
    setForm((prev) => {
      const fields = prev.customFormFields.filter((_, idx) => idx !== index);
      return {
        ...prev,
        customFormFields: fields.map((field, idx) => ({ ...field, order: idx })),
      };
    });
  };

  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      merchandiseDetails: {
        ...prev.merchandiseDetails,
        variants: [...prev.merchandiseDetails.variants, { ...emptyVariant }],
      },
    }));
  };

  const removeVariant = (index) => {
    setForm((prev) => {
      const variants = prev.merchandiseDetails.variants.filter((_, idx) => idx !== index);
      return {
        ...prev,
        merchandiseDetails: { ...prev.merchandiseDetails, variants },
      };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        description: form.description,
        type: form.type,
        category: form.category,
        venue: form.venue,
        eligibility: form.eligibility,
        registrationDeadline: form.registrationDeadline,
        startDate: form.startDate,
        endDate: form.endDate,
        registrationLimit: Number(form.registrationLimit) || 100,
        registrationFee: Number(form.registrationFee) || 0,
        tags: form.tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (form.type !== 'normal') {
        payload.customFormFields = [];
      } else {
        payload.customFormFields = form.customFormFields.map((field, index) => ({
          fieldId: field.fieldId.trim(),
          label: field.label.trim(),
          type: field.type,
          required: Boolean(field.required),
          order: index,
          options: optionFieldTypes.has(field.type)
            ? String(field.optionsRaw || '')
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
            : [],
        }));
      }

      if (form.type !== 'merchandise') {
        payload.merchandiseDetails = { variants: [], purchaseLimitPerParticipant: 1 };
      } else {
        payload.merchandiseDetails = {
          purchaseLimitPerParticipant: Number(form.merchandiseDetails.purchaseLimitPerParticipant) || 1,
          variants: form.merchandiseDetails.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            size: v.size,
            color: v.color,
            price: Number(v.price) || 0,
            stock: Number(v.stock) || 0,
          })),
        };
      }

      const res = await createEventDraft(payload);
      navigate(`/organizer/events/${res.data._id}`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create event draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="stack">
      <div className="card">
        <h2>Create Event (Draft)</h2>
        <form onSubmit={submit} className="form-grid">
          <label>
            Event Name
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
          </label>
          <label>
            Event Type
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="normal">Normal Event</option>
              <option value="merchandise">Merchandise Event</option>
            </select>
          </label>
          <label className="full">
            Description
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </label>
          <label>
            Eligibility
            <select
              value={form.eligibility}
              onChange={(e) => setForm((p) => ({ ...p, eligibility: e.target.value }))}
            >
              <option value="all">All</option>
              <option value="iiit">IIIT only</option>
              <option value="non_iiit">Non-IIIT only</option>
            </select>
          </label>
          <label>
            Category
            <input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="e.g. Technical, Cultural, Sports"
            />
          </label>
          <label>
            Venue
            <input
              value={form.venue}
              onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))}
              placeholder="e.g. IIIT Hyderabad, Himalaya Hall"
            />
          </label>
          <label>
            Registration Deadline
            <input
              type="datetime-local"
              value={form.registrationDeadline}
              onChange={(e) => setForm((p) => ({ ...p, registrationDeadline: e.target.value }))}
              required
            />
          </label>
          <label>
            Start Date
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              required
            />
          </label>
          <label>
            End Date
            <input
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              required
            />
          </label>
          <label>
            Registration Limit
            <input
              type="number"
              min={1}
              value={form.registrationLimit}
              onChange={(e) => setForm((p) => ({ ...p, registrationLimit: Number(e.target.value) || 1 }))}
              required
            />
          </label>
          <label>
            Registration Fee
            <input
              type="number"
              min={0}
              value={form.registrationFee}
              onChange={(e) => setForm((p) => ({ ...p, registrationFee: Number(e.target.value) || 0 }))}
              required
            />
          </label>
          <label className="full">
            Tags (comma separated)
            <input
              value={form.tagsRaw}
              onChange={(e) => setForm((p) => ({ ...p, tagsRaw: e.target.value }))}
            />
          </label>

          {form.type === 'normal' ? (
            <div className="full card subcard">
              <div className="card-row">
                <h3>Custom Registration Form Builder</h3>
                <button type="button" className="btn ghost" onClick={addCustomField}>
                  Add Field
                </button>
              </div>
              {form.customFormFields.length === 0 ? (
                <p className="muted">No custom fields added yet. Use "Add Field" to build form inputs.</p>
              ) : null}
              {form.customFormFields.map((field, idx) => (
                <div key={`${field.fieldId}-${idx}`} className="form-grid">
                  <div className="full row-gap">
                    <strong>Field #{idx + 1}</strong>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => moveCustomField(idx, 'up')}
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => moveCustomField(idx, 'down')}
                    >
                      Move Down
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => removeCustomField(idx)}
                    >
                      Remove
                    </button>
                  </div>
                  <label>
                    Field ID
                    <input
                      value={field.fieldId}
                      onChange={(e) => updateCustomField(idx, { fieldId: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Label
                    <input
                      value={field.label}
                      onChange={(e) => updateCustomField(idx, { label: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(idx, { type: e.target.value })}
                    >
                      <option value="text">text</option>
                      <option value="textarea">textarea</option>
                      <option value="number">number</option>
                      <option value="email">email</option>
                      <option value="dropdown">dropdown</option>
                      <option value="checkbox">checkbox</option>
                      <option value="radio">radio</option>
                      <option value="file">file</option>
                      <option value="date">date</option>
                    </select>
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateCustomField(idx, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  {optionFieldTypes.has(field.type) ? (
                    <label className="full">
                      Options (comma separated)
                      <input
                        value={field.optionsRaw || ''}
                        onChange={(e) => updateCustomField(idx, { optionsRaw: e.target.value })}
                        placeholder="e.g. Beginner, Intermediate, Advanced"
                      />
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {form.type === 'merchandise' ? (
            <div className="full card subcard">
              <div className="card-row">
                <h3>Merchandise Variants</h3>
                <button type="button" className="btn ghost" onClick={addVariant}>
                  Add Variant
                </button>
              </div>

              <label>
                Purchase Limit Per Participant
                <input
                  type="number"
                  min={1}
                  value={form.merchandiseDetails.purchaseLimitPerParticipant}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      merchandiseDetails: {
                        ...prev.merchandiseDetails,
                        purchaseLimitPerParticipant: e.target.value,
                      },
                    }))
                  }
                />
              </label>

              {form.merchandiseDetails.variants.map((variant, idx) => (
                <div key={`${variant.sku}-${idx}`} className="form-grid">
                  <div className="full row-gap">
                    <strong>Variant #{idx + 1}</strong>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => removeVariant(idx)}
                    >
                      Remove
                    </button>
                  </div>
                  <label>
                    SKU
                    <input
                      value={variant.sku}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], sku: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Name
                    <input
                      value={variant.name}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], name: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Size
                    <input
                      value={variant.size}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], size: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                    />
                  </label>
                  <label>
                    Color
                    <input
                      value={variant.color}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], color: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                    />
                  </label>
                  <label>
                    Price
                    <input
                      type="number"
                      min={0}
                      value={variant.price}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], price: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Stock
                    <input
                      type="number"
                      min={0}
                      value={variant.stock}
                      onChange={(e) =>
                        setForm((prev) => {
                          const variants = [...prev.merchandiseDetails.variants];
                          variants[idx] = { ...variants[idx], stock: e.target.value };
                          return {
                            ...prev,
                            merchandiseDetails: { ...prev.merchandiseDetails, variants },
                          };
                        })
                      }
                      required
                    />
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <p className="error full">{error}</p> : null}

          <button type="submit" className="btn full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Draft'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default CreateEventPage;
