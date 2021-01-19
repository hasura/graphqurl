const wsScheme = url => {
  const parts = url.split('//');
  return (parts[0].includes('https') ? 'wss' : 'ws') + '://' + parts[1];
};

const cloneObject = obj => {
  if (!obj || (obj && obj.constructor.name !== 'Object')) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
};

module.exports = {
  wsScheme,
  cloneObject,
};
