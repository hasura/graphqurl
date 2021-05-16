const {cloneObject, wsScheme} = require('./utils');
const fetch = require('isomorphic-fetch');
const WebSocket = require('isomorphic-ws');
const {
  GQL_CONNECTION_INIT,
  GQL_START,
  GQL_STOP,
  GRAPHQL_SUBSCRIPTIONS_PROTOCOL,
  handler: wsEventHandler,
} = require('./events');

const makeClient = options => {
  const {
    endpoint,
    websocket,
    headers,
    hook,
  } = options;

  const clientContext = {
    endpoint,
    headers: cloneObject(headers || {}),
    websocket: {
      ...websocket,
      endpoint: (websocket && websocket.endpoint) || wsScheme(endpoint),
      parameters: (websocket && websocket.parameters) || {},
      client: null,
      open: false,
      subscriptions: {},
    },
  };

  const executeQuery = async (queryOptions, successCallback, errorCallback) => {
    const {
      query,
      variables,
      headers: headerOverrides,
    } = queryOptions;
    try {
      const response = await fetch(
        clientContext.endpoint,
        {
          method: 'POST',
          headers: {
            ...clientContext.headers,
            ...(headerOverrides || {}),
          },
          body: JSON.stringify({query, variables: (variables || {})}),
        },
      );
      const responseObj = await response.json();
      if (hook) {
        hook(responseObj);
      }
      if (responseObj.errors) {
        if (errorCallback) {
          errorCallback(responseObj);
        }
        throw responseObj;
      } else {
        if (successCallback) {
          successCallback(responseObj);
        }
        return responseObj;
      }
    } catch (e) {
      if (e.errors) {
        throw e;
      } else {
        throw {
          errors: [{
            message: 'failed to fetch',
          }],
        };
      }
    }
  };

  const makeWsClient = async () => {
    try {
      const wsConnection = new WebSocket(clientContext.websocket.endpoint, GRAPHQL_SUBSCRIPTIONS_PROTOCOL);
      return wsConnection;
    } catch (e) {
      console.log(e);
      throw new Error('Failed to establish the WebSocket connection: ', e);
    }
  };

  const sendWsEvent = data => {
    clientContext.websocket.client.send(JSON.stringify(data));
  };

  const setWsClient = _wsClient => {
    clientContext.websocket.client = _wsClient;

    if (clientContext.websocket.shouldRetry) {
      _wsClient.onclose = () => {
        makeWsClient().then(setWsClient);
      };
    }

    _wsClient.addEventListener('open', () => {
      const payload = {
        ...clientContext.websocket.parameters,
        headers: {
          ...clientContext.headers,
          ...clientContext.websocket.parameters.headers,
        },
      };
      sendWsEvent({
        type: GQL_CONNECTION_INIT,
        payload,
      });
    });

    _wsClient.addEventListener('message', event => {
      wsEventHandler(clientContext.websocket, event);
    });
  };
  if (websocket) {
    makeWsClient().then(setWsClient).catch(e => {
      console.error(e);
    });
  }

  const subscribe = (subscriptionOptions, successCallback, errorCallback) => {
    if (!clientContext.websocket.client) {
      console.log('WebSocket connection has not been established');
      return;
    }

    const {
      subscription,
      variables,
      onGraphQLData,
      onGraphQLError,
      onGraphQLComplete,
    } = subscriptionOptions;

    const generateOperationId = () => {
      let id = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for (let _i = 0; _i < 5; _i++) {
        id += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return id + (Object.keys(clientContext.websocket.subscriptions).length + 1);
    };

    const operationId = generateOperationId();
    clientContext.websocket.subscriptions[operationId] = {
      onGraphQLData: data => {
        if (onGraphQLData) {
          onGraphQLData(data);
        }
        if (successCallback) {
          successCallback(data);
        }
      },
      onGraphQLComplete,
      onGraphQLError: data => {
        if (onGraphQLError) {
          onGraphQLError(data);
        }
        if (errorCallback) {
          errorCallback(data);
        }
      },
    };

    sendWsEvent({
      type: GQL_START,
      id: operationId,
      payload: {
        query: subscription,
        variables: variables || {},
      },
    });

    return {
      stop: () => {
        sendWsEvent({
          type: GQL_STOP,
          id: operationId,
        });
      },
    };
  };

  const updateHeaders = newHeaders => {
    clientContext.headers = cloneObject(newHeaders);
    if (clientContext.websocket.client) {
      makeWsClient().then(setWsClient).catch(e => {
        console.error(e);
      });
    }
  };

  return {
    query: executeQuery,
    subscribe: subscribe,
    updateHeaders,
  };
};

module.exports = makeClient;
