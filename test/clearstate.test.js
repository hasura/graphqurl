const fetch = require('node-fetch')
const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080'
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345'

const requestHeaders = {
  'content-type': 'application/json',
  'x-hasura-access-key': accessKey,
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

deleteTable().then(() => console.log('Test state cleared'))
