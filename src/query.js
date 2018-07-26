const {HttpLink} = require('apollo-link-http');
const {ApolloClient} = require('apollo-client');
const fetch = require('node-fetch');
const {InMemoryCache} = require('apollo-cache-inmemory');
const gql = require('graphql-tag');
const {cli} = require('cli-ux');
const {CLIError} = require('@oclif/errors');

const Query = async function (endpoint, headers, query, variables, name) {
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
        variables: variables,
        context: {
          headers: headers
        }
      });
    } else if (queryType == 'mutation') {
      q = client.mutate({
        mutation: input,
        variables: variables,
        context: {
          headers: headers
        }
      });
    }
  } catch (err) {
    // console.log(err);
    handleGraphQLError(err);
  }

  let r;
  try {
    response = await q;
  } catch (err) {
    // console.log(err);
    handleServerError(err);
  }

  return response.data;
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
