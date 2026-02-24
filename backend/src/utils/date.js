const isPast = (date) => new Date(date).getTime() < Date.now();

module.exports = {
  isPast,
};
