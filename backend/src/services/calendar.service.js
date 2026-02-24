const encode = encodeURIComponent;

const formatUtc = (date) => {
  const d = new Date(date);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const toICS = ({ title, description, location, startDate, endDate }) => {
  const uid = `felicity-${Date.now()}@iiit-felicity`;
  const now = formatUtc(new Date());
  const start = formatUtc(startDate);
  const end = formatUtc(endDate);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Felicity//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, ' ')}`,
    `LOCATION:${(location || 'IIIT').replace(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};

const buildGoogleCalendarUrl = ({ title, description, startDate, endDate }) => {
  const dates = `${formatUtc(startDate)}/${formatUtc(endDate)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encode(title)}&details=${encode(description || '')}&dates=${encode(dates)}`;
};

const buildOutlookCalendarUrl = ({ title, description, startDate, endDate }) => {
  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encode(title)}&body=${encode(description || '')}&startdt=${encode(new Date(startDate).toISOString())}&enddt=${encode(new Date(endDate).toISOString())}`;
};

module.exports = {
  toICS,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
};
