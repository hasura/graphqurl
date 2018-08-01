const fetch = require('node-fetch')
const {
  testMutationPromise,
  testMutationCallback,
} = require('./mutation.test.js')
const {
  testQueryPromise,
  testQueryCallback,
} = require('./query.test.js')
const {
  testSubscriptionPromise,
  testSubscriptionCallback
} = require('./subscription.test.js')
const hgeUrl = process.env.GRAPHQL_ENGINE_URL || 'http://localhost:8080'
const accessKey = process.env.X_HASURA_ACCESS_KEY || '12345'

const requestHeaders = {
  'content-type': 'application/json',
  'x-hasura-access-key': accessKey,
}

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
  }
  const response = await fetch(
    `${hgeUrl}/v1/query`,
    createTableOpts
  )

  if (response.status !== 200) {
    const respObj = await response.json()
    console.log(respObj)
    console.log('Unexpected: Could not create table')
    process.exit(1)
  }
}

const deleteTable = async () => {
  const deleteTableOpts = {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      type: 'run_sql',
      args: {
        sql: 'drop table graphqurl_test',
      },
    }),
  }
  await fetch(
    `${hgeUrl}/v1/query`,
    deleteTableOpts
  )
}

const runTests = async () => {
  await createTable()
  await testMutationPromise()
  await testMutationCallback()
  wait(5000)
  await testQueryPromise()
  await testQueryCallback()
  await testSubscriptionPromise()
  wait(5000)
  await testSubscriptionCallback()
  wait(5000)
  await deleteTable()
}

const wait = (time) => {
  setTimeout(
    () => null,
    time
  );
}

try {
  runTests()
} catch (e) {
  console.log(e)
}
