# graphqurl

Made by the team at [hasura.io](https://hasura.io), `graphqurl` is a curl like CLI for GraphQL:
- CLI for making GraphQL queries with autocomplete
- Run GraphiQL locally against any endpoint
- Use as a library with Node.js or from the browser
- Supports subscriptions

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphqurl.svg)](https://npmjs.org/package/graphqurl)

[![CircleCI](https://circleci.com/gh/hasura/graphqurl/tree/master.svg?style=shield)](https://circleci.com/gh/hasura/graphqurl/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/hasura/graphqurl?branch=master&svg=true)](https://ci.appveyor.com/project/hasura-bot/graphqurl/branch/master)
[![Downloads/week](https://img.shields.io/npm/dw/graphqurl.svg)](https://npmjs.org/package/graphqurl)
[![License](https://img.shields.io/npm/l/graphqurl.svg)](https://github.com/hasura/graphqurl/blob/master/LICENSE.md)
<!--[![Codecov](https://codecov.io/gh/hasura/graphqurl/branch/master/graph/badge.svg)](https://codecov.io/gh/hasura/graphqurl)-->

----------------
![Graphqurl Demo](assets/subscription.gif)
---
![GraphiQL Demo](assets/graphiql.gif)
---
![Subscriptions triggering bash](assets/bash_trigger.gif)
----------------

## Installation

### CLI

```bash
npm install -g graphqurl
```

### Node Library

```bash
npm install --save graphqurl
```

## Usage

### CLI

#### Query

```bash
gq https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -q 'query { table { column } }'
```

#### Auto-complete

GraphQURL can auto-complete queries using schema introspection. Execute the
command without providing a query string:

```bash
$ gq <endpoint> [-H <header:value>]
Enter the query, use TAB to auto-complete, Ctrl+Q to execute, Ctrl+C to cancel
gql>
```

You can use `TAB` to trigger auto-complete. `Ctrl+C` to cancel the input and
`Ctrl+Q`/`Enter` to execute the query.

#### GraphiQL

Open GraphiQL with a given endpoint:

```bash
gq <endpoint> -i
```

> This is a custom GraphiQL where you can specify request's headers.

#### Mutation

Mutations with variables can be executed by providing the variables with `-v`
flag.

```bash
gq <endpoint> \
   -v 'name=hasura' \
   -q 'mutation ($name: String) { table (objects: [{ name: $name }]) }'
```

#### Subscription

Subscriptions can be executed and the response is streamed on to stdout.

```bash
gq <endpoint> \
   -q 'subscription { table { column } }'
```

### Command

```bash
$ gq ENDPOINT [-q QUERY]
```

#### Args

* `ENDPOINT`: graphql endpoint (can be also set as `GRAPHQURL_ENDPOINT` env var)

#### Options

- `-q, --query=query`: graphql query to exxecute
- `-H, --header="key:value"`: request header
- `-v, --variable="key=value"`: variables used in the query
- `-n, --name=name`: name of the graphql definition to execute, use only if there are multiple definitions
- `--queryFile=/path/to/queryfile`: file to read the query from
- `--variablesFile=/path/to/variablefile`: file to read the query variables from
- `-i, --graphiql`: open graphiql with the given endpoint, headers, query and variables
- `-p, --graphiqlPort=graphiqlPort`: [default: 4500] port to use for graphiql
- `-a, --graphiqlAddress=graphiqlAddress`: [default: localhost] address to use for graphiql
- `-l, --singleLine`: show output in a single line, do not prettify
- `--version`: show CLI version
- `-h, --help`: show CLI help

### Node Library

#### Using callbacks:

```js
const { query } = require('graphqurl');

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

#### Using Promises:

For queries and mutations,

```js
const { query } = require('graphqurl');

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

For subscriptions,

```js
const { query } = require('graphqurl');

query(
  {
    query: 'subscription { table { column } }',
    endpoint: 'https://my-graphql-endpoint/graphql',
    headers: {
      'x-access-key': 'mysecretxxx',
    }
  }
).then((observable) => {
  observable.subscribe(
    (event) => {
      console.log('Event received: ', event);
      // handle event
    },
    (error) => {
      console.log('Error: ', error);
      // handle error
    }
  )
})
 .catch((error) => console.error(error));
```

> Subscriptions are not supported in browsers yet.

### API

#### query(options, successCallback, errorCallback)

- **options**: [Object, *required*] GraphQL query options with the following properties:
  - endpoint: [String, *required*] GraphQL endpoint
  - query: [String, *required*] GraphQL query string
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
  - response: response is a GraphQL compliant JSON object in case of `queries` and `mutations`. However, if you make a subscription, it returns an observable that you can later subscribe to. Check [this example](#subscriptions) to see how to subscribe to observables.

## More Examples

### Node Library

#### Queries

Query example with variables

```js
const { query } = require('graphqurl');

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

#### Mutations

```js
const { query } = require('graphqurl');

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

#### Subscriptions

Using promises,

```js
const { query } = require('graphqurl');

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
  observable.subscribe(
    (event) => {
      console.log('Event received', event);
      // handle event
    },
    (error) => {
      console.log('Error', error);
      // handle error
    }
  )
}).catch(errorCallback);
```

Lets do the above subscription using callbacks,

```js
const { query } = require('graphqurl');

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

### CLI

Generic example:

```bash
gq \
     https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     -v 'variable1=value1' \
     -v 'variable2=value2' \
     -q 'query { table { column } }'
```

Reading the query and variables from a file:

```bash
gq \
     https://my-graphql-endpoint/graphql \
     -H 'Authorization: token <token>' \
     -H 'X-Another-Header: another-header-value' \
     --variableFile='./queryVariables.json' \
     --queryFile='./query.gql
```

Executing only a particular named query from a file that contains many queries:

```bash
gq <endpoint> --queryFile ./queries.gql --name getItems
```

---
Maintained with ♡ by <a href="https://hasura.io">Hasura</a>
