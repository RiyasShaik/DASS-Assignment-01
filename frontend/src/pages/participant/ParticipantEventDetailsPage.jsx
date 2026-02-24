import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getCalendarLinks, getEventDetails } from '../../api/events';
import { createMerchOrder, registerNormalEvent } from '../../api/participant';
import DiscussionForum from '../../components/DiscussionForum';
import LoadingState from '../../components/LoadingState';

const optionFieldTypes = new Set(['dropdown', 'checkbox', 'radio']);

async function downloadIcs(path, ticketCode) {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const resolvedPath = path.startsWith('http')
    ? path
    : path.startsWith('/api')
      ? `${apiBase}${path.slice(4)}`
      : `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`;

  const token = localStorage.getItem('felicity_token');
  const response = await fetch(resolvedPath, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to download ICS');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${ticketCode}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function ParticipantEventDetailsPage() {
  const { eventId } = useParams();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dynamicResponses, setDynamicResponses] = useState({});
  const [dynamicFiles, setDynamicFiles] = useState({});
  const [merchQty, setMerchQty] = useState({});
  const [paymentProof, setPaymentProof] = useState(null);
  const [calendarLinks, setCalendarLinks] = useState(null);

  const event = payload?.event;
  const registration = payload?.registration;

  const refetch = async () => {
    const res = await getEventDetails(eventId);
    setPayload(res.data);
  };

  useEffect(() => {
    let mounted = true;
    getEventDetails(eventId)
      .then((res) => {
        if (!mounted) return;
        setPayload(res.data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.response?.data?.message || err?.message || 'Failed to load event details');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [eventId]);

  useEffect(() => {
    if (!registration?.ticketId?.ticketId) return;

    getCalendarLinks(registration.ticketId.ticketId)
      .then((res) => setCalendarLinks(res.data))
      .catch(() => setCalendarLinks(null));
  }, [registration?.ticketId?.ticketId]);

  const sortedCustomFields = useMemo(
    () => [...(event?.customFormFields || [])].sort((a, b) => a.order - b.order),
    [event?.customFormFields]
  );

  const registrationBlocked = useMemo(() => {
    if (!event) return true;
    if (!['published', 'ongoing'].includes(event.status)) return true;
    if (new Date(event.registrationDeadline).getTime() < Date.now()) return true;
    if (event.type === 'normal' && Number(event.totalRegistrations || 0) >= Number(event.registrationLimit || 0)) {
      return true;
    }
    if (event.type === 'merchandise') {
      const variants = event.merchandiseDetails?.variants || [];
      if (variants.length === 0 || variants.every((variant) => Number(variant.stock || 0) <= 0)) {
        return true;
      }
    }
    return false;
  }, [event]);

  const registrationBlockingReason = useMemo(() => {
    if (!event) return 'Event unavailable.';
    if (!['published', 'ongoing'].includes(event.status)) return 'Registrations are closed for this event status.';
    if (new Date(event.registrationDeadline).getTime() < Date.now()) return 'Registration deadline has passed.';
    if (event.type === 'normal' && Number(event.totalRegistrations || 0) >= Number(event.registrationLimit || 0)) {
      return 'Registration limit is full.';
    }
    if (event.type === 'merchandise') {
      const variants = event.merchandiseDetails?.variants || [];
      if (variants.length === 0 || variants.every((variant) => Number(variant.stock || 0) <= 0)) {
        return 'All merchandise variants are out of stock.';
      }
    }
    return '';
  }, [event]);

  const submitNormalRegistration = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('dynamicResponses', JSON.stringify(dynamicResponses));

      Object.entries(dynamicFiles).forEach(([fieldId, file]) => {
        if (!file) return;
        formData.append(`dynamicFile__${fieldId}`, file);
      });

      const res = await registerNormalEvent(eventId, formData);
      setSuccess(`Registered successfully. Ticket ID: ${res.data?.ticket?.ticketId || 'Issued'}`);
      setDynamicFiles({});
      await refetch();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to register for event');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMerchOrder = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const items = Object.entries(merchQty)
        .map(([sku, qty]) => ({ sku, quantity: Number(qty) }))
        .filter((item) => item.quantity > 0);

      if (items.length === 0) {
        throw new Error('Select at least one item quantity');
      }

      if (!paymentProof) {
        throw new Error('Upload payment proof to place order');
      }

      const formData = new FormData();
      formData.append('paymentProof', paymentProof);
      formData.append('items', JSON.stringify(items));

      await createMerchOrder(eventId, formData);
      setSuccess('Order submitted for organizer approval. QR ticket will be generated after approval.');
      await refetch();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to place merchandise order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading event..." />;
  if (!event) return (
    <section className="stack">
      <div className="card">
        <h2>Event Not Found</h2>
        <p className="error">{error || 'Unable to load event details.'}</p>
      </div>
    </section>
  );

  return (
    <section className="stack">
      <div className="card">
        <h2>{event.name}</h2>
        <p>{event.description}</p>
        <div className="meta-grid">
          <span>Type: {event.type}</span>
          <span>Eligibility: {event.eligibility === 'all' ? 'Open to All' : event.eligibility === 'iiit' ? 'IIIT Only' : 'Non-IIIT'}</span>
          <span>Organizer: {event.organizerId?.organizerName || 'N/A'}</span>
          {event.category ? <span>Category: {event.category}</span> : null}
          {event.venue ? <span>Venue: {event.venue}</span> : null}
          <span>Deadline: {dayjs(event.registrationDeadline).format('DD MMM YYYY HH:mm')}</span>
          <span>Start: {dayjs(event.startDate).format('DD MMM YYYY HH:mm')}</span>
          <span>End: {dayjs(event.endDate).format('DD MMM YYYY HH:mm')}</span>
          <span>Fee: ₹{event.registrationFee}</span>
          <span>Status: <strong>{event.status}</strong></span>
        </div>
      </div>

      <div className="card">
        <h3>Registration / Purchase</h3>

        {registration ? (
          <div className="notice success">
            <p>
              Current status: <strong>{registration.status}</strong>
            </p>
            <p>Payment status: {registration.paymentStatus}</p>
            {registration.ticketId?.ticketId ? <p>Ticket ID: {registration.ticketId.ticketId}</p> : null}
          </div>
        ) : null}

        {!registration && event.type === 'normal' ? (
          <>
            <h4>Normal Event Form</h4>
            <div className="form-grid">
              {sortedCustomFields.map((field) => {
                const value = dynamicResponses[field.fieldId];
                const options = optionFieldTypes.has(field.type) ? field.options || [] : [];

                if (field.type === 'textarea') {
                  return (
                    <label key={field.fieldId} className="full">
                      {field.label} {field.required ? '*' : ''}
                      <textarea
                        rows={3}
                        value={value || ''}
                        onChange={(e) =>
                          setDynamicResponses((prev) => ({
                            ...prev,
                            [field.fieldId]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  );
                }

                if (field.type === 'dropdown') {
                  return (
                    <label key={field.fieldId}>
                      {field.label} {field.required ? '*' : ''}
                      <select
                        value={value || ''}
                        onChange={(e) =>
                          setDynamicResponses((prev) => ({
                            ...prev,
                            [field.fieldId]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select</option>
                        {options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === 'radio') {
                  return (
                    <div key={field.fieldId}>
                      <p>
                        {field.label} {field.required ? '*' : ''}
                      </p>
                      <div className="row-gap">
                        {options.map((option) => (
                          <label key={option} className="inline-check">
                            <input
                              type="radio"
                              name={field.fieldId}
                              checked={value === option}
                              onChange={() =>
                                setDynamicResponses((prev) => ({
                                  ...prev,
                                  [field.fieldId]: option,
                                }))
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'checkbox') {
                  const selected = Array.isArray(value) ? value : [];
                  return (
                    <div key={field.fieldId}>
                      <p>
                        {field.label} {field.required ? '*' : ''}
                      </p>
                      <div className="row-gap">
                        {options.map((option) => (
                          <label key={option} className="inline-check">
                            <input
                              type="checkbox"
                              checked={selected.includes(option)}
                              onChange={(e) =>
                                setDynamicResponses((prev) => {
                                  const existing = Array.isArray(prev[field.fieldId])
                                    ? prev[field.fieldId]
                                    : [];
                                  const next = e.target.checked
                                    ? [...existing, option]
                                    : existing.filter((entry) => entry !== option);
                                  return {
                                    ...prev,
                                    [field.fieldId]: next,
                                  };
                                })
                              }
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (field.type === 'file') {
                  return (
                    <label key={field.fieldId}>
                      {field.label} {field.required ? '*' : ''}
                      <input
                        type="file"
                        onChange={(e) =>
                          setDynamicFiles((prev) => ({
                            ...prev,
                            [field.fieldId]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                    </label>
                  );
                }

                return (
                  <label key={field.fieldId}>
                    {field.label} {field.required ? '*' : ''}
                    <input
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : field.type === 'email'
                              ? 'email'
                              : 'text'
                      }
                      value={value || ''}
                      onChange={(e) =>
                        setDynamicResponses((prev) => ({
                          ...prev,
                          [field.fieldId]: e.target.value,
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              className="btn"
              disabled={registrationBlocked || submitting}
              onClick={submitNormalRegistration}
            >
              {submitting ? 'Submitting...' : 'Register'}
            </button>
          </>
        ) : null}

        {!registration && event.type === 'merchandise' ? (
          <>
            <h4>Merchandise Purchase</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Variant</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(event.merchandiseDetails?.variants || []).map((variant) => (
                    <tr key={variant.sku}>
                      <td>{variant.name}</td>
                      <td>
                        {variant.size || '-'} | {variant.color || '-'}
                      </td>
                      <td>INR {variant.price}</td>
                      <td>{variant.stock}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={variant.stock}
                          value={merchQty[variant.sku] || 0}
                          onChange={(e) =>
                            setMerchQty((prev) => ({
                              ...prev,
                              [variant.sku]: e.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label>
              Upload Payment Proof
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
              />
            </label>

            <button
              type="button"
              className="btn"
              disabled={registrationBlocked || submitting}
              onClick={submitMerchOrder}
            >
              {submitting ? 'Submitting...' : 'Submit Purchase'}
            </button>
          </>
        ) : null}

        {registrationBlocked && !registration ? (
          <p className="error">{registrationBlockingReason || 'Registration is currently blocked.'}</p>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
      </div>

      {registration?.ticketId?.ticketId ? (
        <div className="card">
          <h3>Ticket & QR</h3>
          <p>
            Ticket ID: <strong>{registration.ticketId.ticketId}</strong>
          </p>
          <img src={registration.ticketId.qrDataUrl} alt="Ticket QR" className="qr-image" />
          <h4>Add to Calendar</h4>
          {calendarLinks ? (
            <div className="row-gap">
              <a className="btn ghost" href={calendarLinks.googleUrl} target="_blank" rel="noreferrer">
                Google Calendar
              </a>
              <a className="btn ghost" href={calendarLinks.outlookUrl} target="_blank" rel="noreferrer">
                Outlook
              </a>
              <button
                type="button"
                className="btn ghost"
                onClick={() => downloadIcs(calendarLinks.icsDownloadPath, registration.ticketId.ticketId)}
              >
                Download .ics
              </button>
            </div>
          ) : (
            <p className="muted">Calendar links unavailable right now.</p>
          )}
        </div>
      ) : null}

      {registration ? (
        <DiscussionForum eventId={eventId} canModerate={false} />
      ) : (
        <div className="card">
          <h3>Live Discussion Forum</h3>
          <p className="muted">Forum access unlocks after successful registration/purchase.</p>
        </div>
      )}
    </section>
  );
}

export default ParticipantEventDetailsPage;
