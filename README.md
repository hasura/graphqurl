# graphqurl

Made by the team at [hasura.io](https://hasura.io), `graphqurl` is a curl like CLI for GraphQL:
- CLI for making GraphQL queries with autocomplete
- Run GraphiQL locally against any endpoint
- Use as a library with Node.js or from the browser
- Supports subscriptions
- Export GraphQL schema

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphqurl.svg)](https://npmjs.org/package/graphqurl)

[![Azure Pipelines](https://dev.azure.com/hasura/graphqurl/_apis/build/status/hasura.graphqurl?branchName=master)](https://dev.azure.com/hasura/graphqurl/_build/latest?definitionId=1&branchName=master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/hasura/graphqurl?branch=master&svg=true)](https://ci.appveyor.com/project/hasura-bot/graphqurl/branch/master)
[![Downloads/week](https://img.shields.io/npm/dw/graphqurl.svg)](https://npmjs.org/package/graphqurl)
[![License](https://img.shields.io/npm/l/graphqurl.svg)](https://github.com/hasura/graphqurl/blob/master/LICENSE)
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
     -H 'Authorization: Bearer <token>' \
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


#### Subscription

Subscriptions can be executed and the response is streamed on to stdout.

```bash
gq <endpoint> \
   -q 'subscription { table { column } }'
```

#### Export schema

Export GraphQL schema to GraphQL or JSON format:

```bash
gq <endpoint> --introspect > schema.graphql

# json
gq <endpoint> --introspect --format json > schema.json
```

### Command

```bash
$ gq ENDPOINT [-q QUERY]
```

#### Args

* `ENDPOINT`: graphql endpoint (can be also set as `GRAPHQURL_ENDPOINT` env var)

#### Options

- `-q, --query=query`: graphql query to execute
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
const { createClient } = require('graphqurl');

const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql',
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

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

client.query(
  {
    query: 'query ($id: Int) { table_by_id (id: $id) { column } }',
    variables: { id: 24 }
  },
  successCallback,
  errorCallback
);

```

#### Using Promises:

For queries and mutations,

```js
const { createClient } = require('graphqurl');

const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql',
  headers: {
    'Authorization': 'Bearer <token>'
  }
});

client.query(
  {
    query: 'query ($id: Int) { table_by_id (id: $id) { column } }',
    variables: { id: 24 }
  }
).then((response) => console.log(response))
 .catch((error) => console.error(error));
```

For subscriptions,

```js
const { createClient } = require('graphqurl');

const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql',
  headers: {
    'Authorization': 'Bearer <token>'
  }
  websocket: {
    endpoint: 'wss://my-graphql-endpoint/graphql',
    onConnectionSuccess: () => console.log('Connected'),
    onConnectionError: () => console.log('Connection Error'),
  }
});

client.subscribe(
  {
    subscription: 'subscription { table { column } }',
  },
  (event) => {
    console.log('Event received: ', event);
    // handle event
  },
  (error) => {
    console.log('Error: ', error);
    // handle error
  }
)
```

### API

#### createClient(options)

The `createClient` function is available as a named export. It takes init options and returns `client`.

```
const { createClient } = require('graphqurl');
```


- **options**: [Object, *required*] graphqurl init options with the following properties:
  - endpoint: [String, *required*] GraphQL endpoint
  - headers: [Object] Request header, defaults to `{}`. These headers will be added along with all the GraphQL queries, mutations and subscriptions made through the client.
  - websocket: [Object] Options for configuring subscriptions over websocket. Subscriptions are not supported if this field is empty.
    - endpoint: [String, ] WebSocket endpoint to run GraphQL subscriptions.
    - shouldRetry: [Boolean] Boolean value whether to retry closed websocket connection. Defaults to false.
    - parameters: [Object] Payload to send the connection init message with
    - onConnectionSuccess: [void => void] Callback function called when the GraphQL connection is successful. Please not that this is different from the websocket connection being open. Please check the [followed protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md) for more details.
    - onConnectionError: [error => null] Callback function called if the GraphQL connection over websocket is unsuccessful
    - onConnectionKeepAlive: [void => null]: Callback function called when the GraphQL server sends `GRAPHQL_CONNECTION_KEEP_ALIVE` messages to keep the connection alive.

- **Returns**: [client]

#### Client


```js
const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql'
});
```

The graphqurl client exposeses the following methods:

- **client.query**: [(queryoptions, successCallback, errorCallback) => Promise (response)]
  - queryOptions: [Object *required*]
    - query: [String *required*] The GraphQL query or mutation to be executed over HTTP
    - variables: [Object] GraphQL query variables. Defaults to `{}`
    - headers: [Object] Header overrides. If you wish to make a GraphQL query while adding to or overriding the headers provided during initalisations, you can pass the headers here.
  - successCallback: [response => null] Success callback which is called after a successful response. It is called with the following parameters:
    - response: The response of your query
  - errorCallback: [error => null] Error callback which is called after the occurrence of an error. It is called with the following parameters:
    - error: The occurred error
  - **Returns**: [Promise (response) ] This function returns the response wrapped in a promise.
    - response: response is a GraphQL compliant JSON object in case of `queries` and `mutations`.

- **client.subscribe**: [(subscriptionOptions, eventCallback, errorCallback) => Function (stop)]
  - subscriptionOptions: [Object *required*]
    - subscription: [String *required*] The GraphQL subscription to be started over WebSocket
    - variables: [Object] GraphQL query variables. Defaults to `{}`
    - onGraphQLData: [(response) => null] You can optionally pass this function as an event callback
    - onGraphQLError: [(response) => null] You can optionally pass this function as an error callback
    - onGraphQLComplete: [() => null] Callback function called when the GraphQL subscription is declared as `complete` by the server and no more events will be received
  - eventCallback: [(response) => null] Event callback which is called after receiving an event from the given subscription. It is called with the following parameters:
    - event: The received event from the subscription
  - errorCallback: [error => null] Error callback which is called after the occurrence of an error. It is called with the following parameters:
    - error: The occurred error
  - **Returns**: [void => null] This is a function to stop the subscription


## More Examples

### Node Library

#### Queries and Mutations

Query example with variables

```js
const { createClient } = require('graphqurl');

const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql',
  headers: {
    'x-access-key': 'mysecretxxx',
  },
});

client.query(
  {
    query: `
      query ($name: String) {
        table(where: { column: $name }) {
          id
          column
        }
      }
    `,
    variables: {
      name: 'Alice'
    }
  }
).then((response) => console.log(response))
 .catch((error) => console.error(error));
```

#### Subscriptions

Using promises,

```js
const { createClient } = require('graphqurl');
const client = createClient({
  endpoint: 'https://my-graphql-endpoint/graphql',
  headers: {
    'Authorization': 'Bearer Andkw23kj=Kjsdk2902ksdjfkd'
  }
  websocket: {
    endpoint: 'wss://my-graphql-endpoint/graphql',
  }
})

const eventCallback = (event) => {
  console.log('Event received:', event);
  // handle event
};

const errorCallback = (error) => {
  console.log('Error:', error)
};

client.subscribe(
  {
    query: 'subscription { table { column } }',
  },
  eventCallback,
  errorCallback
)
```


### CLI

Generic example:

```bash
gq \
     https://my-graphql-endpoint/graphql \
     -H 'Authorization: Bearer <token>' \
     -H 'X-Another-Header: another-header-value' \
     -v 'variable1=value1' \
     -v 'variable2=value2' \
     -q 'query { table { column } }'
```

---
Maintained with :heart: by <a href="https://hasura.io">Hasura</a>
