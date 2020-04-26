const { cloneObject } = require('./utils');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const {
  GRAPHQL_SUBSCRIPTIONS_PROTOCOL,
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_STOP,
  GQL_START,
  GQL_STOP,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_KEEP_ALIVE,
  GQL_DATA,
  GQL_ERROR,
  GQL_COMPLETE,
} = require('./constants');

const makeClient = (options) => {

  const {
    endpoint,
    websocket,
    headers
  } = options;

  let clientHeaders = cloneObject(headers || {});

  const updateHeaders = (newHeaders) => {
    clientHeaders = cloneObject(newHeaders || {});
  };

  const makeQuery = async (queryOptions, successCallback, errorCallback) => {
    const {
      query,
      variables,
      headers: headerOverrides,
    } = queryOptions;
    try {
      const response = await fetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            ...clientHeaders,
            ...(headerOverrides || {})
          },
          body: JSON.stringify({query, variables: (variables || {})})
        }
      );
      const responseObj = await response.json();
      if (responseObj.errors) {
        if (errorCallback) {
          errorCallback(responseObj)
        }
        throw responseObj
      } else {
        if (successCallback) {
          successCallback(responseObj)
        }
        return responseObj;
      }
    } catch (e) {
      if (e.errors) {
        throw e;
      } else {
        throw {
          errors: [{
            message: "failed to fetch"
          }]
        }
      }
    }
  }

  const isReady = (w) => {
    return w && w.readyState === w.OPEN
  }
  const makeWsClient = async () => {
    const {
      endpoint: wsEndpoint,
      headers: wsHeaders,
      parameters,
      onConnectionSuccess,
      onConnectionError,
      onConnectionKeepAlive,
      shouldRetry
    } = websocket;

    try {
      wsConnection = new WebSocket(wsEndpoint, 'graphql-ws')
      return wsConnection;
    } catch (e) {
      console.log(e);
      throw new Error('Failed to establish the WebSocket connection: ', e);
    }
  }

  const subscriptionsContext = {
    ...websocket,
    client: null,
    subscriptions: {},
    open: false
  };

  const setWsClient = _wsClient => {

    subscriptionsContext.client = _wsClient

    if (websocket.shouldRetry) {
      _wsClient.onclose = () => {
        makeWsClient().then(setWsClient);
      }
    }

    _wsClient.onopen = () => {
      console.log("OPEN");
      sendWsEvent({
        type: GQL_CONNECTION_INIT,
        payload: {
          ...(subscriptionsContext.parameters || {}),
          ...(subscriptionsContext.headers || {})
        } 
      });
    }

    _wsClient.onmessage = (event) => {
      wsEventHandler(subscriptionsContext, event);    
    }
  }
  if (websocket) {
    makeWsClient().then(setWsClient).catch(e => {
      console.error(e);
    });
  }

  const sendWsEvent = (data) => {
    console.log("Sending ")
    console.log(data);
    subscriptionsContext.client.send(JSON.stringify(data));
  };

  const subscribe = (subscriptionOptions, successCallback, errorCallback) => {


    if (!subscriptionsContext.client) {
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
      let id = ""
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for ( let _i = 0; _i < 5; _i++ ) {
        id += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return id + (Object.keys(subscriptionsContext.subscriptions).length + 1);
    }

    const operationId = generateOperationId();
    subscriptionsContext.subscriptions[operationId] = {
      onGraphQLData,
      onGraphQLComplete,
      onGraphQLError
    };

    let retry = 0;
    console.log("whiling")
    while (!subscriptionsContext.open) {
      retry ++;
      if (retry % 50 === 0) {
        console.log('Waiting for websocket connection to be ready');
      }
      console.log(retry);
    }

    console.log("Sendinggg");
    sendWsEvent({
      type: GQL_START,
      id: operationId,
      payload: {
        query: subscription,
        variables: variables || {}
      }
    });

  }

  return {
    query: makeQuery,
    subscribe: subscribe
  }

}

const wsEventHandler = (ctx, event) => {

  let { data } = event;
  try {
    data = JSON.parse(data);
  } catch (e) {
    console.error('unable to parse event data; unexpected event from server');
    return;
  }

  let s;
  switch (data.type) {
    case GQL_CONNECTION_ACK:
      console.log('ack');
      ctx.onConnectionSuccess && ctx.onConnectionSuccess();
      ctx.open = true;
      return;
    case GQL_CONNECTION_ERROR:
      console.log('err');
      ctx.onConnectionError && ctx.onConnectionError();
      return;
    case GQL_CONNECTION_KEEP_ALIVE:
      ctx.onConnectionKeepAlive && ctx.onConnectionKeepAlive();
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
    case GQL_COMPLETE:
      s = ctx.subscriptions[data.id];
      if (s && s.onGraphQLComplete) {
        s.onGraphQLComplete(data.payload);
      }
      delete ctx.subscriptions[data.id];
      return;
  }
}

