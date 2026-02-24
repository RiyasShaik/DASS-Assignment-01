const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const NUM = '23456789';
const SPEC = '@#$%&*!';

const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];

const generateStrongPassword = (length = 12) => {
  const required = [pick(LOWER), pick(UPPER), pick(NUM), pick(SPEC)];
  const all = `${LOWER}${UPPER}${NUM}${SPEC}`;
  while (required.length < length) {
    required.push(pick(all));
  }
  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = required[i];
    required[i] = required[j];
    required[j] = tmp;
  }
  return required.join('');
};

module.exports = generateStrongPassword;
