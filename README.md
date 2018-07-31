graphqurl
===========

curl graphql

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphqurl.svg)](https://npmjs.org/package/graphqurl)

[![CircleCI](https://circleci.com/gh/hasura/graphqurl/tree/master.svg?style=shield)](https://circleci.com/gh/hasura/graphqurl/tree/master)

[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/hasura/graphqurl?branch=master&svg=true)](https://ci.appveyor.com/project/hasura/graphqurl/branch/master)
[![Codecov](https://codecov.io/gh/hasura/graphqurl/branch/master/graph/badge.svg)](https://codecov.io/gh/hasura/graphqurl)
[![Downloads/week](https://img.shields.io/npm/dw/graphqurl.svg)](https://npmjs.org/package/graphqurl)
[![License](https://img.shields.io/npm/l/graphqurl.svg)](https://github.com/hasura/graphqurl/blob/master/package.json)

<!-- toc -->

# Installation

## CLI Tool

```bash
$ npm install -g graphqurl
```

## Node Library

```
$ npm install --save graphqurl
```


# Usage

## CLI Tool

### Example

```
gq \
     --endpoint https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     -v 'variable1=value1' \
     -v 'variable2=value2' \
     'query { table { column } }'
```

### Command

```bash
$ gq [QUERY]
```

#### Args

* **QUERY**: graphql query as a string

#### Options

- **-H, --header=header**: request header
- **-e, --endpoint=endpoint**: (required) graphql endpoint to run the query
- **-h, --help**: show CLI help
- **-v, --variable=variable**: variables used in the query
- **--queryFile=/path/to/queryfile**: file to read the query from
- **--variablesFile=/path/to/variablefile**: file to read the query variables from
- **--version**: show CLI version


## Node Library

### Example

#### Using Promises:

For queries and mutations,

```js
const query = require('graphqurl');

query(
  {
    query: 'query { table { column } }',
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'x-access-key': 'mysecretxxx',
    }
  }
).then((response) => console.log(response))
 .catch((error) => console.error(error));
```

#### Using callbacks:

```js
const query = require('graphqurl');

function successCallback(response, queryType, parsedQuery) {
  if (queryType === 'subscription') {
    // handle subscription response
  } else {
    // handle query/mutation response
  }
}

function errorCallback(error, queryType, parsedQuery) {
  console.error(error);
}

query(
  {
    query: 'query { table { column } }',
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'x-access-key': 'mysecretxxx',
    }
  },
  successCalllback,
  errorCallback
);

```

### API

#### query(options, successCallback, errorCallback)**

- **options**: [Object, *required*] GraphQL query options with the following properties:
  - endpoint: [String, *required*] GraphQL endpoint
  - query: [String, *required*] GrapHQL query string
  - headers: [Object] Request headers, defaults to `{}`
  - variables: [Object] GraphQL query variables, defaults to '{}'
  - name: [String] Operation name. Used only if the `query` string contains multiple operations.
- **successCallback**: [Function] Success callback which is called after a successful response. It is called with the following parameters:
  - response: The response of your query
  - queryType: The type of query you made i.e. one [`query`, `mutation`, `subcription`]
  - parsedQuery: The query parsed into a GraphQL document
- **errorCallback**: [Function] Error callback which is called after a the occurance of an error. It is called with the following parameters:
  - error: The occured error
  - queryType: [String] The type of query you made i.e. one [`query`, `mutation`, `subcription`]
  - parsedQuery: [Object] The query parsed into a GraphQL document
- **Returns**: [Promise (response) ]If `successCallback` and `errorCallback` are not provided, this function returns the response wrapped in a promise.
  - response: response is a GraphQL compliant JSON object in case of `queries` and `mutations`. However, if you make a subscription, it returns an observable that you can later subscribe to. Check [this example]() to see how to subscribe to observables.
  
  
## More Examples

### Node Library

#### Queries

Query with query variables:

```
const query = require('graphqurl');

query(
  {
    query: `
      mutation ($id_insert_input: String!, $column_insert_input: String!) {
        insert_to_table (
          id: $id_insert_input,
          column: $column_insert_input
        ) {
          affected_rows
        }
      }
    `,
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'x-access-key': 'mysecretxxx',
    },
    variables: {
      id_insert_input: 'id_ak23sdfkjk2',
      column_insert_input: 'Bob'
    }
  }
).then((response) => console.log(response))
 .catch((error) => console.error(error));
```

#### Mutations

```
const query = require('graphqurl');

query(
  {
    query: `
      query ($name: String) {
        table(where: { column: $name }) {
          id
          column
        }
      }
    `,
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'x-access-key': 'mysecretxxx',
    },
    variables: {
      name: 'Alice'
    }
  }
).then((response) => console.log(response))
 .catch((error) => console.error(error));
```

#### Subscriptions

Using callbacks

```js
const query = require('graphqurl');

function eventCallback(event) {
  console.log('Event received:', event);
  // handle event
}

function errorCallback(error) {
  console.log('Error:', error)
}

query(
  {
    query: 'subscription { table { column } }',
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'Authorization': 'Bearer Andkw23kj=Kjsdk2902ksdjfkd'
    }
  },
  eventCallback,
  errorCallback
);
```

Lets do the above example using a promise:

```js
const query = require('graphqurl');

const eventCallback = (event) => {
  console.log('Event received:', event);
  // handle event
};

const errorCallback = (error) => {
  console.log('Error:', error)
};

query(
  {
    query: 'subscription { table { column } }',
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'Authorization': 'Bearer Andkw23kj=Kjsdk2902ksdjfkd'
    }
  },
).then((observable) => {
  observable.subscribe(eventCallback, errorCallback)
}).catch(errorCallback);
```

## CLI tool

Generic example:

```
gq \
     --endpoint https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     -v 'variable1=value1' \
     -v 'variable2=value2' \
     'query { table { column } }'
```

Reading the query and variables from a file:

```
gq \
     --endpoint https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     --variableFile='./queryVariables.json' \
     --queryFile='./variablesFile.gql'
```
