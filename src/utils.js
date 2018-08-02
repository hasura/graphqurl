const {SubscriptionClient} = require('subscriptions-transport-ws');
const {WebSocketLink} = require('apollo-link-ws');
const ws = require('ws');
const {execute} = require('apollo-link');

const makeWsLink = function (uri, headers, query, errorCb) {
  return new WebSocketLink(new SubscriptionClient(
    uri,
    {
      reconnect: true,
      connectionParams: {
        headers,
      },
      connectionCallback: error => {
        if (error) {
          if (!errorCb) {
            console.error(error);
            return;
          }
          errorCb(
            error,
            'subscription',
            query
          );
        }
      },
    },
    ws
  ));
};

const makeObservable = (query, variables, endpoint, headers, errorCb) => {
  return execute(
    makeWsLink(endpoint, headers, query, errorCb),
    {
      query,
      variables,
    }
  );
};

module.exports = {
  makeWsLink,
  makeObservable,
};
