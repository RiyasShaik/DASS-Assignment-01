import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import DiscussionForum from '../../components/DiscussionForum';
import LoadingState from '../../components/LoadingState';
import QrAttendanceScanner from '../../components/QrAttendanceScanner';
import {
  getAttendanceDashboard,
  getOrganizerEventDetails,
  overrideAttendance,
  publishEvent,
  reviewOrder,
  scanTicket,
  updateEvent,
} from '../../api/organizer';

async function downloadCsv(endpoint, filename) {
  const token = localStorage.getItem('felicity_token');
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('CSV export failed');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function extractTicketCode(decodedText) {
  try {
    const parsed = JSON.parse(decodedText);
    return parsed.ticketId || decodedText;
  } catch {
    return decodedText;
  }
}

const optionFieldTypes = new Set(['dropdown', 'checkbox', 'radio']);

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

function OrganizerEventDetailsPage() {
  const { eventId } = useParams();

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [allParticipants, setAllParticipants] = useState([]);
  const [attendance, setAttendance] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const [editForm, setEditForm] = useState({
    description: '',
    registrationDeadline: '',
    registrationLimit: 1,
    status: '',
  });

  // Draft structured form state
  const [draftForm, setDraftForm] = useState({
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
      variants: [],
      purchaseLimitPerParticipant: 1,
    },
  });

  const [scanCode, setScanCode] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [scanError, setScanError] = useState('');
  const [overrideForm, setOverrideForm] = useState({ registrationId: '', reason: '' });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const event = payload?.event;

  const initDraftForm = (eventData) => {
    setDraftForm({
      name: eventData.name || '',
      description: eventData.description || '',
      type: eventData.type || 'normal',
      category: eventData.category || '',
      venue: eventData.venue || '',
      eligibility: eventData.eligibility || 'all',
      registrationDeadline: eventData.registrationDeadline
        ? new Date(eventData.registrationDeadline).toISOString().slice(0, 16)
        : '',
      startDate: eventData.startDate
        ? new Date(eventData.startDate).toISOString().slice(0, 16)
        : '',
      endDate: eventData.endDate
        ? new Date(eventData.endDate).toISOString().slice(0, 16)
        : '',
      registrationLimit: eventData.registrationLimit || 100,
      registrationFee: eventData.registrationFee || 0,
      tagsRaw: (eventData.tags || []).join(', '),
      customFormFields: (eventData.customFormFields || []).map((f) => ({
        ...f,
        optionsRaw: (f.options || []).join(', '),
      })),
      merchandiseDetails: eventData.merchandiseDetails || {
        variants: [],
        purchaseLimitPerParticipant: 1,
      },
    });
  };

  const fetchData = async () => {
    const [detailsRes, attendanceRes] = await Promise.all([
      getOrganizerEventDetails(eventId, {
        search: search || undefined,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
      }),
      getAttendanceDashboard(eventId).catch(() => ({ data: null })),
    ]);

    setPayload(detailsRes.data);
    setAttendance(attendanceRes.data);
    setAllParticipants(detailsRes.data?.participants || []);
    setEditForm({
      description: detailsRes.data.event.description || '',
      registrationDeadline: detailsRes.data.event.registrationDeadline
        ? new Date(detailsRes.data.event.registrationDeadline).toISOString().slice(0, 16)
        : '',
      registrationLimit: detailsRes.data.event.registrationLimit || 1,
      status: detailsRes.data.event.status,
    });

    initDraftForm(detailsRes.data.event);
  };

  useEffect(() => {
    let mounted = true;
    fetchData()
      .catch((err) => {
        if (mounted) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load event details');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const participants = useMemo(() => payload?.participants || [], [payload]);
  const merchOrders = useMemo(
    () => allParticipants.filter((participant) => participant.type === 'merchandise'),
    [allParticipants]
  );

  const applyFilters = async () => {
    setLoading(true);
    try {
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Filter failed');
    } finally {
      setLoading(false);
    }
  };

  const saveEdits = async () => {
    setError('');
    setFeedback('');

    try {
      const currentStatus = event?.status;
      let updatePayload;

      if (currentStatus === 'published') {
        updatePayload = {
          description: editForm.description,
          registrationDeadline: editForm.registrationDeadline,
          registrationLimit: Number(editForm.registrationLimit),
          status: editForm.status,
        };
      } else {
        // ongoing, completed, closed — only status transition allowed
        updatePayload = {
          status: editForm.status,
        };
      }

      await updateEvent(eventId, updatePayload);
      setFeedback('Event updated successfully');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update event');
    }
  };

  const publish = async () => {
    setError('');
    setFeedback('');

    try {
      await publishEvent(eventId);
      setFeedback('Event published successfully');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to publish event');
    }
  };

  const saveDraftPayload = async () => {
    setError('');
    setFeedback('');

    try {
      const payload = {
        name: draftForm.name,
        description: draftForm.description,
        type: draftForm.type,
        category: draftForm.category,
        venue: draftForm.venue,
        eligibility: draftForm.eligibility,
        registrationDeadline: draftForm.registrationDeadline,
        startDate: draftForm.startDate,
        endDate: draftForm.endDate,
        registrationLimit: Number(draftForm.registrationLimit) || 100,
        registrationFee: Number(draftForm.registrationFee) || 0,
        tags: draftForm.tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (draftForm.type === 'normal') {
        payload.customFormFields = draftForm.customFormFields.map((field, index) => ({
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
        payload.merchandiseDetails = { variants: [], purchaseLimitPerParticipant: 1 };
      } else {
        payload.customFormFields = [];
        payload.merchandiseDetails = {
          purchaseLimitPerParticipant:
            Number(draftForm.merchandiseDetails.purchaseLimitPerParticipant) || 1,
          variants: draftForm.merchandiseDetails.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            size: v.size,
            color: v.color,
            price: Number(v.price) || 0,
            stock: Number(v.stock) || 0,
          })),
        };
      }

      await updateEvent(eventId, payload);
      setFeedback('Draft updated successfully');
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update draft');
    }
  };

  // Draft form helper functions
  const addCustomField = () => {
    setDraftForm((prev) => ({
      ...prev,
      customFormFields: [
        ...prev.customFormFields,
        { ...emptyField, order: prev.customFormFields.length },
      ],
    }));
  };

  const updateCustomField = (index, patch) => {
    setDraftForm((prev) => {
      const fields = [...prev.customFormFields];
      fields[index] = { ...fields[index], ...patch };
      return { ...prev, customFormFields: fields };
    });
  };

  const removeCustomField = (index) => {
    setDraftForm((prev) => {
      const fields = prev.customFormFields.filter((_, idx) => idx !== index);
      return {
        ...prev,
        customFormFields: fields.map((field, idx) => ({ ...field, order: idx })),
      };
    });
  };

  const addVariant = () => {
    setDraftForm((prev) => ({
      ...prev,
      merchandiseDetails: {
        ...prev.merchandiseDetails,
        variants: [...prev.merchandiseDetails.variants, { ...emptyVariant }],
      },
    }));
  };

  const removeVariant = (index) => {
    setDraftForm((prev) => {
      const variants = prev.merchandiseDetails.variants.filter((_, idx) => idx !== index);
      return {
        ...prev,
        merchandiseDetails: { ...prev.merchandiseDetails, variants },
      };
    });
  };

  const reviewPending = async (registrationId, decision) => {
    setError('');
    setFeedback('');
    try {
      await reviewOrder(eventId, registrationId, {
        decision,
        comment: decision === 'approved' ? 'Payment verified' : 'Proof mismatch',
      });
      setFeedback(`Order ${decision}`);
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to review order');
    }
  };

  const handleScan = async (decodedText, method = 'manual') => {
    setScanMessage('');
    setScanError('');
    const ticketCode = extractTicketCode(decodedText).trim();
    if (!ticketCode) return;

    try {
      const res = await scanTicket(eventId, { ticketCode, method });
      setScanMessage(res.message || 'Attendance marked');
      setScanCode('');
      await fetchData();
    } catch (err) {
      setScanError(err?.response?.data?.message || 'Scan failed');
    }
  };

  const submitManualOverride = async () => {
    setError('');
    setFeedback('');

    try {
      await overrideAttendance(eventId, overrideForm);
      setFeedback('Manual override recorded');
      setOverrideForm({ registrationId: '', reason: '' });
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to override attendance');
    }
  };

  const exportParticipants = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '/api';
      await downloadCsv(`${base}/organizer/events/${eventId}/participants/export`, `participants-${eventId}.csv`);
    } catch {
      setError('Participant export failed');
    }
  };

  const exportAttendance = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '/api';
      await downloadCsv(`${base}/organizer/events/${eventId}/attendance/export`, `attendance-${eventId}.csv`);
    } catch {
      setError('Attendance export failed');
    }
  };

  if (loading) return <LoadingState label="Loading organizer event details..." />;
  if (!event) return (
    <section className="stack">
      <div className="card">
        <h2>Event Not Found</h2>
        <p className="error">{error || 'Unable to load event details. The event may not exist or you may not have permission to view it.'}</p>
        <button type="button" className="btn" onClick={() => { setLoading(true); setError(''); fetchData().catch((err) => setError(err?.response?.data?.message || 'Failed to load')).finally(() => setLoading(false)); }}>Retry</button>
      </div>
    </section>
  );

  return (
    <section className="stack">
      <div className="card">
        <h2>{event.name}</h2>
        <div className="meta-grid">
          <span>Type: {event.type}</span>
          <span>Status: {event.status}</span>
          <span>Category: {event.category || 'N/A'}</span>
          <span>Venue: {event.venue || 'N/A'}</span>
          <span>Registration Deadline: {new Date(event.registrationDeadline).toLocaleString()}</span>
          <span>Start: {new Date(event.startDate).toLocaleString()}</span>
          <span>End: {new Date(event.endDate).toLocaleString()}</span>
          <span>Eligibility: {event.eligibility}</span>
          <span>Fee: INR {event.registrationFee}</span>
          <span>Limit: {event.registrationLimit}</span>
        </div>

        <h3>Edit / Status Actions</h3>
        {event.status === 'draft' ? (
          <div className="stack">
            <p className="muted">
              Draft mode — update any field below. Save Draft to persist changes, then Publish when ready.
            </p>
            <div className="form-grid">
              <label>
                Event Name
                <input
                  value={draftForm.name}
                  onChange={(e) => setDraftForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label>
                Event Type
                <select
                  value={draftForm.type}
                  onChange={(e) => setDraftForm((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="normal">Normal Event</option>
                  <option value="merchandise">Merchandise Event</option>
                </select>
              </label>
              <label className="full">
                Description
                <textarea
                  rows={4}
                  value={draftForm.description}
                  onChange={(e) => setDraftForm((p) => ({ ...p, description: e.target.value }))}
                  required
                />
              </label>
              <label>
                Eligibility
                <select
                  value={draftForm.eligibility}
                  onChange={(e) => setDraftForm((p) => ({ ...p, eligibility: e.target.value }))}
                >
                  <option value="all">All</option>
                  <option value="iiit">IIIT only</option>
                  <option value="non_iiit">Non-IIIT only</option>
                </select>
              </label>
              <label>
                Category
                <input
                  value={draftForm.category}
                  onChange={(e) => setDraftForm((p) => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Technical, Cultural, Sports"
                />
              </label>
              <label>
                Venue
                <input
                  value={draftForm.venue}
                  onChange={(e) => setDraftForm((p) => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. IIIT Hyderabad, Himalaya Hall"
                />
              </label>
              <label>
                Registration Deadline
                <input
                  type="datetime-local"
                  value={draftForm.registrationDeadline}
                  onChange={(e) => setDraftForm((p) => ({ ...p, registrationDeadline: e.target.value }))}
                  required
                />
              </label>
              <label>
                Start Date
                <input
                  type="datetime-local"
                  value={draftForm.startDate}
                  onChange={(e) => setDraftForm((p) => ({ ...p, startDate: e.target.value }))}
                  required
                />
              </label>
              <label>
                End Date
                <input
                  type="datetime-local"
                  value={draftForm.endDate}
                  onChange={(e) => setDraftForm((p) => ({ ...p, endDate: e.target.value }))}
                  required
                />
              </label>
              <label>
                Registration Limit
                <input
                  type="number"
                  min={1}
                  value={draftForm.registrationLimit}
                  onChange={(e) => setDraftForm((p) => ({ ...p, registrationLimit: Number(e.target.value) || 1 }))}
                  required
                />
              </label>
              <label>
                Registration Fee
                <input
                  type="number"
                  min={0}
                  value={draftForm.registrationFee}
                  onChange={(e) => setDraftForm((p) => ({ ...p, registrationFee: Number(e.target.value) || 0 }))}
                  required
                />
              </label>
              <label className="full">
                Tags (comma separated)
                <input
                  value={draftForm.tagsRaw}
                  onChange={(e) => setDraftForm((p) => ({ ...p, tagsRaw: e.target.value }))}
                />
              </label>
            </div>

            {draftForm.type === 'normal' ? (
              <div className="card subcard">
                <div className="card-row">
                  <h4>Custom Registration Form Builder</h4>
                  <button type="button" className="btn ghost" onClick={addCustomField}>
                    Add Field
                  </button>
                </div>
                {draftForm.customFormFields.length === 0 ? (
                  <p className="muted">No custom fields added yet.</p>
                ) : null}
                {draftForm.customFormFields.map((field, idx) => (
                  <div key={`${field.fieldId}-${idx}`} className="form-grid">
                    <div className="full row-gap">
                      <strong>Field #{idx + 1}</strong>
                      <button type="button" className="btn danger" onClick={() => removeCustomField(idx)}>
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

            {draftForm.type === 'merchandise' ? (
              <div className="card subcard">
                <div className="card-row">
                  <h4>Merchandise Variants</h4>
                  <button type="button" className="btn ghost" onClick={addVariant}>
                    Add Variant
                  </button>
                </div>
                <label>
                  Purchase Limit Per Participant
                  <input
                    type="number"
                    min={1}
                    value={draftForm.merchandiseDetails.purchaseLimitPerParticipant}
                    onChange={(e) =>
                      setDraftForm((prev) => ({
                        ...prev,
                        merchandiseDetails: {
                          ...prev.merchandiseDetails,
                          purchaseLimitPerParticipant: Number(e.target.value) || 1,
                        },
                      }))
                    }
                  />
                </label>
                {draftForm.merchandiseDetails.variants.map((variant, idx) => (
                  <div key={`${variant.sku}-${idx}`} className="form-grid">
                    <div className="full row-gap">
                      <strong>Variant #{idx + 1}</strong>
                      <button type="button" className="btn danger" onClick={() => removeVariant(idx)}>
                        Remove
                      </button>
                    </div>
                    <label>
                      SKU
                      <input
                        value={variant.sku}
                        onChange={(e) =>
                          setDraftForm((prev) => {
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
                          setDraftForm((prev) => {
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
                          setDraftForm((prev) => {
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
                          setDraftForm((prev) => {
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
                          setDraftForm((prev) => {
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
                          setDraftForm((prev) => {
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

            <div className="row-gap">
              <button type="button" className="btn" onClick={saveDraftPayload}>
                Save Draft
              </button>
              <button type="button" className="btn ghost" onClick={publish}>
                Publish Event
              </button>
            </div>
          </div>
        ) : (
          <>
            {event.status === 'published' ? (
              <div className="form-grid">
                <label className="full">
                  Description
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </label>
                <label>
                  Registration Deadline
                  <input
                    type="datetime-local"
                    value={editForm.registrationDeadline}
                    onChange={(e) => setEditForm((p) => ({ ...p, registrationDeadline: e.target.value }))}
                  />
                </label>
                <label>
                  Registration Limit
                  <input
                    type="number"
                    min={1}
                    value={editForm.registrationLimit}
                    onChange={(e) => setEditForm((p) => ({ ...p, registrationLimit: e.target.value }))}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="published">published</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="form-grid">
                <label>
                  Status
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    {event.status === 'ongoing' ? (
                      <>
                        <option value="ongoing">ongoing</option>
                        <option value="completed">completed</option>
                        <option value="closed">closed</option>
                      </>
                    ) : null}
                    {event.status === 'completed' ? (
                      <>
                        <option value="completed">completed</option>
                        <option value="closed">closed</option>
                      </>
                    ) : null}
                    {event.status === 'closed' ? (
                      <option value="closed">closed</option>
                    ) : null}
                  </select>
                </label>
                <p className="muted">
                  Only status transitions are allowed for {event.status} events.
                </p>
              </div>
            )}
            <div className="row-gap">
              <button type="button" className="btn" onClick={saveEdits}>
                Save Changes
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>Analytics</h3>
        <div className="meta-grid">
          <span>Registrations/Sales: {payload?.analytics?.registrations || 0}</span>
          <span>Attendance: {payload?.analytics?.attendance || 0}</span>
          <span>Team Completion: {payload?.analytics?.completedTeams || 0}</span>
          <span>Revenue: INR {payload?.analytics?.revenue || 0}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-row">
          <h3>Participants</h3>
          <button type="button" className="btn ghost" onClick={exportParticipants}>
            Export CSV
          </button>
        </div>

        <form
          className="filter-grid"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <label>
            Search Name/Email
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="registered">registered</option>
              <option value="pending_approval">pending_approval</option>
              <option value="purchase_success">purchase_success</option>
              <option value="completed">completed</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label>
            Payment
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All</option>
              <option value="not_required">not_required</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <button type="submit" className="btn">
            Filter
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Reg Date</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Team</th>
                <th>Ticket</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p._id}>
                  <td>{`${p.participantId?.firstName || ''} ${p.participantId?.lastName || ''}`}</td>
                  <td>{p.participantId?.email || 'N/A'}</td>
                  <td>{new Date(p.createdAt).toLocaleString()}</td>
                  <td>{p.paymentStatus}</td>
                  <td>{p.status}</td>
                  <td>-</td>
                  <td>{p.ticketId?.ticketId || '-'}</td>
                  <td>{p.attendanceMarked ? 'Present' : 'Absent'}</td>
                </tr>
              ))}
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={8}>No participants found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {event.type === 'merchandise' ? (
        <div className="card">
          <h3>Merchandise Orders (Pending/Approved/Rejected)</h3>
          {merchOrders.length === 0 ? <p className="muted">No merchandise orders yet.</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Email</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment Proof</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {merchOrders.map((order) => (
                  <tr key={order._id}>
                    <td>{`${order.participantId?.firstName || ''} ${order.participantId?.lastName || ''}`.trim()}</td>
                    <td>{order.participantId?.email || 'N/A'}</td>
                    <td>INR {order.totalAmount}</td>
                    <td>{order.paymentStatus}</td>
                    <td>
                      {order.paymentProofUrl ? (
                        <a href={order.paymentProofUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {order.paymentStatus === 'pending' ? (
                        <div className="row-gap">
                          <button type="button" className="btn" onClick={() => reviewPending(order._id, 'approved')}>
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn danger"
                            onClick={() => reviewPending(order._id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        'Reviewed'
                      )}
                    </td>
                  </tr>
                ))}
                {merchOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No orders found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-row">
          <h3>Attendance Tracking</h3>
          <button type="button" className="btn ghost" onClick={exportAttendance}>
            Export Attendance CSV
          </button>
        </div>

        <div className="meta-grid">
          <span>Scanned: {attendance?.scannedCount || 0}</span>
          <span>Not Scanned: {attendance?.notScannedCount || 0}</span>
        </div>

        <h4>Scanned Participants</h4>
        <div className="table-wrap" style={{ marginBottom: '2rem' }}>
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Scan Time</th>
                <th>Ticket ID</th>
              </tr>
            </thead>
            <tbody>
              {(attendance?.scanned || []).map((row) => (
                <tr key={`scanned-${row._id}`}>
                  <td>{`${row.participantId?.firstName || ''} ${row.participantId?.lastName || ''}`.trim()}</td>
                  <td>{row.attendanceAt ? new Date(row.attendanceAt).toLocaleString() : '-'}</td>
                  <td>{row.ticketId?.ticketId || '-'}</td>
                </tr>
              ))}
              {(attendance?.scanned?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={3}>No participants have been scanned yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <h4>Pending Participants</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Participant</th>
                <th>Registration Status</th>
              </tr>
            </thead>
            <tbody>
              {(attendance?.notScanned || []).map((row) => (
                <tr key={`pending-${row._id}`}>
                  <td>{`${row.participantId?.firstName || ''} ${row.participantId?.lastName || ''}`.trim()}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
              {(attendance?.notScanned?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={2}>No pending participants.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <QrAttendanceScanner onScan={handleScan} />

        <div className="inline-form">
          <input
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            placeholder="Manual ticket code"
          />
          <button type="button" className="btn" onClick={() => handleScan(scanCode, 'manual')}>
            Scan Ticket
          </button>
        </div>

        {scanMessage ? <p className="success">{scanMessage}</p> : null}
        {scanError ? <p className="error">{scanError}</p> : null}

        <h4>Manual Override</h4>
        <div className="inline-form">
          <input
            value={overrideForm.registrationId}
            onChange={(e) =>
              setOverrideForm((prev) => ({ ...prev, registrationId: e.target.value }))
            }
            placeholder="Registration ID"
          />
          <input
            value={overrideForm.reason}
            onChange={(e) => setOverrideForm((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder="Reason"
          />
          <button type="button" className="btn ghost" onClick={submitManualOverride}>
            Apply Override
          </button>
        </div>
      </div>

      <DiscussionForum eventId={eventId} canModerate />

      {error ? <p className="error">{error}</p> : null}
      {feedback ? <p className="success">{feedback}</p> : null}
    </section>
  );
}

export default OrganizerEventDetailsPage;
