const { HttpLink } = require('apollo-link-http');
const { ApolloClient } = require('apollo-client');
const { execute } = require('apollo-link');
const { SubscriptionClient } = require('subscriptions-transport-ws');
const { WebSocketLink } = require('apollo-link-ws');
const ws = require('ws');
const fetch = require('node-fetch');
const { InMemoryCache } = require('apollo-cache-inmemory');
const gql = require('graphql-tag');
const { cli } = require('cli-ux');

const Query = async function (options, successCb, errorCb) {
  const { query, endpoint, headers, variables, name } = options;
  const client = new ApolloClient({
    link: new HttpLink({ uri: endpoint, fetch: fetch }),
    cache: new InMemoryCache({ addTypename: false })
  });

  let input, queryType;
  try {
    input = gql`${query}`;
    if (input.definitions && input.definitions.length > 0) {
      if (name) {
        if (input.definitions.length > 1) {
          let found = false;
          for (let d of input.definitions) {
            if (d.name.value == name) {
              input = {kind: 'Document', definitions: [d]};
              queryType = d.operation;
              found = true;
              break;
            }
          }
          if (!found) {
            errorCb(
              (`query with name '${name}' not found in input`),
              null,
              input
            );
            return;
          }
        } else {
          if (input.definitions[0].name.value !== name) {
            errorCb(
              (`query with name '${name}' not found in input`),
              null,
              input
            );
            return;
          }
        }
      }
      queryType = input.definitions[0].operation;
    }
  } catch(err) {
    // console.log(err);
    errorCb(
      err,
      null,
      input
    );
  }
  let q;
  try {
    if (queryType == 'query') {
      q = client.query({
        query: input,
        variables,
        context: {
          headers
        }
      });
    } else if (queryType == 'mutation') {
      q = client.mutate({
        mutation: input,
        variables,
        context: {
          headers
        }
      });
    } else if (queryType == 'subscription') {
      q = makeObservable(input, variables, endpoint, headers, errorCb);
    }
  } catch (err) {
    // console.log(err);
    errorCb(err, queryType, input);
  }
  let response;
  try {
    if (queryType === 'subscription') {
      response = q.subscribe(
        (event) => {
          successCb(event, 'subscription', input);
        },
        (error) => {
          errorCb(error, 'subscription', input);
        }
      );
    } else {
      response = await q;
      successCb(response, queryType, input);
    }
  } catch (err) {
    errorCb(err, queryType, input);
  }
};

const makeObservable = (query, variables, endpoint, headers, errorCb) => {
  return execute(
    mkWsLink(endpoint, headers, query, errorCb),
    {
      query,
      variables
    }
  );
};


const mkWsLink = function(uri, headers, query, errorCb) {
  return new WebSocketLink(new SubscriptionClient(
    uri,
    {
      reconnect: true,
      connectionParams: {
        headers
      },
      connectionCallback: (error) => {
        if (error) {
          errorCb(
            error,
            'subscription',
            query
          );
        }
      }
    },
    ws
  ));
};



module.exports = Query;
