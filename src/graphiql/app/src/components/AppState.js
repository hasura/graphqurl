const stateKey = 'CONSOLE_LOCAL_INFO:' + window.__env.graphqlEndpoint;

const loadAppState = () => JSON.parse(window.localStorage.getItem(stateKey));

const saveAppState = state => {
  window.localStorage.setItem(stateKey, JSON.stringify(state));
};

const loadAccessKeyState = () =>
  window.localStorage.getItem('CONSOLE_ACCESS_KEY');

const saveAccessKeyState = state => {
  window.localStorage.setItem('CONSOLE_ACCESS_KEY', state);
};

const clearState = () => window.localStorage.removeItem(stateKey);

export {
  saveAppState,
  saveAccessKeyState,
  loadAppState,
  loadAccessKeyState,
  clearState,
};
