const query = require('..')
const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080'
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345'

const testSubscriptionPromise = async () => {
  const subOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `subscription ($id:Int) {
      graphqurl_test(where: { id: { _eq: $id} }){
        text
      }
    }`,
    variables: {
      id: 3,
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  }
  let respLength = null
  const observable = await query(subOpts)
  let subscription = observable.subscribe(
    event => {
      if (event.data && event.data.graphqurl_test) {
        respLength = event.data.graphqurl_test.length
      } else {
        console.log('Failed: Subscription with promise')
        console.log(JSON.stringify(event, null, 2))
        process.exit(1)
      }
    },
    error => {
      console.log('Failed: Subscription with promise')
      console.log(JSON.stringify(error, null, 2))
      process.exit(1)
    }
  )
  setTimeout(
    () => {
      if (respLength === null || respLength === undefined) {
        console.log('Failed: Subscription with promise')
        console.log('Mutation did not trigger an event', respLength)
        process.exit(1)
      }
    },
    10000
  )
  const mutationResp = await query({
    ...subOpts,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 3,
      text: 'Jill',
    },
  })
  if (mutationResp.data.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          subscription.unsubscribe()
          console.log('Passed: Subscription with promise')
        } else {
          console.log('Failed: Subscription with promise')
          console.log('Mutation did not trigger an event', respLength)
        }
      },
      15000
    )
  }
}

const testSubscriptionCallback = async () => {
  const subOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `subscription ($id:Int) {
      graphqurl_test(where: { id: { _eq: $id} }){
        text
      }
    }`,
    variables: {
      id: 4,
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  }
  let respLength = null
  await query(
    subOpts,
    event => {
      if (event.data && event.data.graphqurl_test) {
        respLength = event.data.graphqurl_test.length
      } else {
        console.log('Failed: Subscription with callback')
        console.log(JSON.stringify(event, null, 2))
        process.exit(1)
      }
    },
    error => {
      console.log('Failed: Subscription with callback')
      console.log(JSON.stringify(error, null, 2))
      process.exit(1)
    }
  )
  setTimeout(
    () => {
      if (respLength === null || respLength === undefined) {
        console.log('Failed: Subscription with callback')
        process.exit(1)
      }
    },
    10000
  )
  const mutationResp = await query({
    ...subOpts,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 4,
      text: 'Jack',
    },
  })
  if (mutationResp.data.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          console.log('Passed: Subscription with callback')
          process.exit(0)
        } else {
          console.log('Failed: Subscription with callback')
        }
      },
      15000
    )
  }
}

module.exports = {
  testSubscriptionCallback,
  testSubscriptionPromise,
}
