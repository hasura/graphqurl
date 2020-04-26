const GRAPHQL_SUBSCRIPTIONS_PROTOCOL = 'graphql-ws';

// events emitted from client to server
const GQL_CONNECTION_INIT = 'connection_init';
const GQL_CONNECTION_STOP = 'connection_terminate';
const GQL_START = 'start';
const GQL_STOP = 'stop';

// events received from server by client
const GQL_CONNECTION_ERROR = 'connection_error';
const GQL_CONNECTION_ACK = 'connection_ack';
const GQL_CONNECTION_KEEP_ALIVE = 'ka';
const GQL_DATA = 'data';
const GQL_ERROR = 'error';
const GQL_COMPLETE = 'complete';

module.exports = {
  GRAPHQL_SUBSCRIPTIONS_PROTOCOL,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_STOP,
  GQL_START,
  GQL_STOP,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_KEEP_ALIVE,
  GQL_DATA,
  GQL_ERROR,
  GQL_COMPLETE,
};