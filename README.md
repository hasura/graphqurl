# graphqurl

curl graphql

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphqurl.svg)](https://npmjs.org/package/graphqurl)

[![CircleCI](https://circleci.com/gh/hasura/graphqurl/tree/master.svg?style=shield)](https://circleci.com/gh/hasura/graphqurl/tree/master)

[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/hasura/graphqurl?branch=master&svg=true)](https://ci.appveyor.com/project/hasura/graphqurl/branch/master)
[![Codecov](https://codecov.io/gh/hasura/graphqurl/branch/master/graph/badge.svg)](https://codecov.io/gh/hasura/graphqurl)
[![Downloads/week](https://img.shields.io/npm/dw/graphqurl.svg)](https://npmjs.org/package/graphqurl)
[![License](https://img.shields.io/npm/l/graphqurl.svg)](https://github.com/hasura/graphqurl/blob/master/package.json)

<!-- toc -->

## Installation

### CLI Tool

```bash
$ npm install -g graphqurl
```

### Node Library

```
$ npm install --save graphqurl
```

## Usage

### As a CLI Tool

```bash
gq \
  --endpoint https://my-graphql-endpoint/graphql \
  -H 'Authorization: token <token>'
  -H 'X-Another-Header: another-header-value'
  'query { table { column } }'
```

### As a Node Library

#### Using callbacks

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

#### Using Promises

```
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

## API

### CLI Tool

#### Command

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

#### Example

```
gq \
     --endpoint https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     -v 'variable1=value1' \
     -v 'variable2=value2' \
     'query { table { column } }'
```

### Node Library

#### Function

##### query(options, successCallback, errorCallback)

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

