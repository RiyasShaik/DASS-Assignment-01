const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

const hasSmtp = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);

if (hasSmtp) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

const sendMail = async ({ to, subject, html, text }) => {
  if (!transporter) {
    // Safe fallback for local/dev when SMTP is not configured.
    console.log('[MAIL:DEV-FALLBACK]', { to, subject, text });
    return { accepted: [to], mocked: true };
  }

  return transporter.sendMail({
    from: env.smtp.from,
    to,
    subject,
    html,
    text,
  });
};

const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const sendTicketMail = async ({ to, participantName, eventName, ticketId }) => {
  const subject = `Ticket Confirmed: ${eventName}`;
  const text = `Hi ${participantName}, your registration is confirmed. Ticket ID: ${ticketId}`;
  const safeName = escapeHtml(participantName);
  const safeEvent = escapeHtml(eventName);
  const safeTicket = escapeHtml(ticketId);
  const html = `<p>Hi ${safeName},</p><p>Your registration for <strong>${safeEvent}</strong> is confirmed.</p><p><strong>Ticket ID:</strong> ${safeTicket}</p>`;
  return sendMail({ to, subject, text, html });
};

module.exports = {
  sendMail,
  sendTicketMail,
};
