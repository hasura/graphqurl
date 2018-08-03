const {HttpLink} = require('apollo-link-http');
const {ApolloClient} = require('apollo-client');
const fetch = require('node-fetch');
const {InMemoryCache} = require('apollo-cache-inmemory');
const gql = require('graphql-tag');
const {makeObservable} = require('./utils');

const query = async function (options, successCb, errorCb) {
  const {query, endpoint, headers, variables, name} = options;
  const client = new ApolloClient({
    link: new HttpLink({uri: endpoint, fetch: fetch}),
    cache: new InMemoryCache(),
  });

  let input, queryType;
  try {
    input = gql`${query}`;
    if (input.definitions && input.definitions.length > 0) {
      if (name) {
        if (input.definitions.length > 1) {
          let found = false;
          for (let d of input.definitions) {
            if (d.name.value === name) {
              input = {kind: 'Document', definitions: [d]};
              queryType = d.operation;
              found = true;
              break;
            }
          }
          if (!found) {
            if (!errorCb) {
              throw ({
                error: `query with name '${name}' not found in input`,
              });
            }
            errorCb(
              {
                error: `query with name '${name}' not found in input`,
              },
              null,
              input
            );
            return;
          }
        } else if (input.definitions[0].name.value !== name) {
          if (!errorCb) {
            throw ({
              error: `query with name '${name}' not found in input`,
            });
          }
          errorCb(
            {
              error: `query with name '${name}' not found in input`,
            },
            null,
            input
          );
          return;
        }
      }
      queryType = input.definitions[0].operation;
    }
  } catch (err) {
    if (!errorCb) {
      throw err;
    }
    errorCb(
      err,
      null,
      input
    );
  }
  let q;
  try {
    if (queryType === 'query') {
      q = client.query({
        query: input,
        variables,
        context: {
          headers,
        },
      });
    } else if (queryType === 'mutation') {
      q = client.mutate({
        mutation: input,
        variables,
        context: {
          headers,
        },
      });
    } else if (queryType === 'subscription') {
      q = makeObservable(input, variables, endpoint, headers, errorCb);
    }
  } catch (err) {
    // console.log(err);
    if (!errorCb) {
      throw err;
    }
    errorCb(err, queryType, input);
  }
  let response;
  try {
    if (queryType === 'subscription') {
      if (!successCb) {
        return q;
      }
      response = q.subscribe(
        event => {
          successCb(event, 'subscription', input);
        },
        error => {
          if (!errorCb) {
            console.error(error);
            return;
          }
          errorCb(error, 'subscription', input);
        }
      );
    } else {
      if (!successCb) {
        response = await q;
        return response;
      }
      response = await q;
      successCb(response, queryType, input);
    }
  } catch (err) {
    if (!errorCb) {
      throw err;
    }
    errorCb(err, queryType, input);
  }
};

module.exports = query;
