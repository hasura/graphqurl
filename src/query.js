const { HttpLink } = require('apollo-link-http');
const { ApolloClient } = require('apollo-client');
const { split } = require('apollo-link');
const { getMainDefinition } = require('apollo-utilities');
const { SubscriptionClient } = require('subscriptions-transport-ws');
const { WebSocketLink } = require('apollo-link-ws');
const ws = require('ws');
const fetch = require('node-fetch');
const { InMemoryCache } = require('apollo-cache-inmemory');
const gql = require('graphql-tag');
const {cli} = require('cli-ux');
const { CLIError } = require('@oclif/errors');

const mkWsUri = function (uri) {
  const parsedUri = uri.split('//');
  if (parsedUri[0] === 'https:') {
    return `wss://${parsedUri[1]}`;
  }
  return uri;
};

const mkWsLink = function(uri, headers) {
  return new WebSocketLink(new SubscriptionClient(
    mkWsUri(uri),
    {
      reconnect: true,
      connectionParams: {
        headers
      }
    },
    ws
  ));
};

const mkConditionalLink = function(uri, headers) {
  const httpLink = new HttpLink({ uri, fetch: fetch });
  return split(
    ({ query }) => {
      const { kind, operation } = getMainDefinition(query);
      return kind === 'OperationDefinition' && operation === 'subscription';
    },
    mkWsLink(uri, headers),
    httpLink,
  );
};

const Query = async function (ctx, endpoint, headers, query, variables, name) {
  const client = new ApolloClient({
    link: mkConditionalLink(endpoint, headers),
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
            throw new CLIError(`query with name '${name}' not found in input`);
          }
        } else {
          if (input.definitions[0].name.value !== name) {
            throw new CLIError(`query with name '${name}' not found in input`);
          }
        }
      }
      queryType = input.definitions[0].operation;
    }
  } catch(err) {
    // console.log(err);
    handleGraphQLError(err);
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
      const observable = client.subscribe({
        query: input,
        variables
      });
      q = observable;
    }
  } catch (err) {
    // console.log(err);
    handleGraphQLError(err);
  }

  let response;
  try {
    if (queryType == 'subscription') {
      response = 'Subscribed to the query';
      q.subscribe({
        function (event) {
          ctx.log('Here');
          ctx.log(event);
        },
        function (err) {
          ctx.log('here');
          handleServerError(err);
        }
      });
    } else {
      response = await q;
      console.log(response);
    }
  } catch (err) {
    // console.log(err);
    handleServerError(err);
  }

  return response;
};

const handleGraphQLError = (err) => {
  if (err.message) {
    let errorMessage = err.message;
    if (err.locations) {
      let locs = [];
      for (l of err.locations) {
        locs.push(`line: ${l.line}, column: ${l.column}`);
      }
      errorMessage += `\n${locs.join(',')}`;
    }
    throw new CLIError(errorMessage);
  } else {
    throw err;
  }
  throw err;
};

const handleServerError = (err) => {
  if (err.networkError && err.networkError.statusCode) {
    if (err.networkError.result && err.networkError.result.errors) {
      let errorMessages = [];
      for (e of err.networkError.result.errors) {
        errorMessages.push(`[${e.code}] at [${e.path}]: ${e.error}`);
      }
      throw new CLIError(errorMessages.join('\n'));
    } else {
      throw new CLIError(err.message);
    }
  } else {
    throw err;
  }
};

module.exports = Query;
