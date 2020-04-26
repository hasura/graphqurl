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

const handler = (ctx, event) => {
  let {data} = event;
  try {
    data = JSON.parse(data);
  } catch (e) {
    console.error('unable to parse event data; unexpected event from server');
    return;
  }

  let s;
  switch (data.type) {
  case GQL_CONNECTION_ACK:
    if (ctx.onConnectionSuccess) {
      ctx.onConnectionSuccess();
    }
    ctx.open = true;
    return;
  case GQL_CONNECTION_ERROR:
    if (ctx.onConnectionError) {
      ctx.onConnectionError(data);
    }
    return;
  case GQL_CONNECTION_KEEP_ALIVE:
    if (ctx.onConnectionKeepAlive) {
      ctx.onConnectionKeepAlive();
    }
    return;
  case GQL_DATA:
    s = ctx.subscriptions[data.id];
    if (s && s.onGraphQLData) {
      s.onGraphQLData(data.payload);
    }
    return;
  case GQL_ERROR:
    s = ctx.subscriptions[data.id];
    if (s && s.onGraphQLError) {
      s.onGraphQLError(data.payload);
    }
    return;
  case GQL_CONNECTION_STOP:
    return;
  case GQL_COMPLETE:
    s = ctx.subscriptions[data.id];
    if (s && s.onGraphQLComplete) {
      s.onGraphQLComplete(data.payload);
    }
    delete ctx.subscriptions[data.id];
  }
};

module.exports = {
  handler,
  GQL_CONNECTION_INIT,
  GQL_START,
  GQL_STOP,
  GRAPHQL_SUBSCRIPTIONS_PROTOCOL,
};
