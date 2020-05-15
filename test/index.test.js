const fetch = require('node-fetch');
const {
  testMutationPromise,
  testMutationCallback,
} = require('./mutation.test.js');
const {
  testQueryPromise,
  testQueryCallback,
} = require('./query.test.js');
const {
  testSubscriptionPromise,
  testSubscriptionCallback,
} = require('./subscription.test.js');
const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080';
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345';
const {createClient} = require('../src');
const {wsScheme} = require('../src/utils');

const requestHeaders = {
  'content-type': 'application/json',
  'x-hasura-access-key': accessKey,
};

const createTable = async () => {
  const createTableOpts = {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      type: 'bulk',
      args: [
        {
          type: 'run_sql',
          args: {
            sql: 'CREATE TABLE public."graphqurl_test"("id" integer NOT NULL, "text" text NOT NULL, PRIMARY KEY ("id") );',
          },
        },
        {
          type: 'add_existing_table_or_view',
          args: {
            name: 'graphqurl_test',
            schema: 'public',
          },
        },
      ],
    }),
  };
  const response = await fetch(
    `${hgeUrl}/v1/query`,
    createTableOpts
  );

  if (response.status !== 200) {
    const respObj = await response.json();
    console.log('Unexpected: Could not create table');
    console.log(respObj);
  }
};

const runTests = async () => {
  const client = createClient({
    endpoint: `${hgeUrl}/v1/graphql`,
    headers: requestHeaders,
    websocket: {
      endpoint: wsScheme(`${hgeUrl}/v1/graphql`),
    },
  });
  await testMutationPromise(client);
  await testMutationCallback(client);
  await testQueryPromise(client);
  await testQueryCallback(client);
  await testSubscriptionPromise(client);
  await testSubscriptionCallback(client);
};

createTable().then(async () => {
  runTests();
}).catch(e => {
  console.log(e);
});
