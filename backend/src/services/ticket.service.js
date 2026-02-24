const QRCode = require('qrcode');
const { customAlphabet } = require('nanoid');

const ticketAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

const generateTicketId = () => `FLT-${ticketAlphabet()}`;

const buildQrPayload = ({ ticketId, eventId, participantId }) =>
  JSON.stringify({
    ticketId,
    eventId,
    participantId,
    issuedAt: new Date().toISOString(),
  });

const generateQrDataUrl = async (payload) => {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 400,
  });
};

module.exports = {
  generateTicketId,
  buildQrPayload,
  generateQrDataUrl,
};
