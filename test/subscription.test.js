const query = require('..')
const hgeUrl = process.env.GRAPHQL_ENGINE_URL || 'http://localhost:8080'
const accessKey = process.env.X_HASURA_ACCESS_KEY || '12345'

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
  observable.subscribe(
    (event) => {
      if (event.data && event.data.graphqurl_test) {
        respLength = event.data.graphqurl.test.length;
      }
      else {
        console.log('Failed: Subscription with promise')
        console.log(event)
        process.exit(1);
      }
    },
    (error) => {
      console.log('Failed: Subscription with promise')
      console.log(error)
      process.exit(1);
    }
  );
  setTimeout(
    () => {
      if (respLength !== 0) {
        console.log('Failed: Subscription with promise');
        process.exit(1);
      }
    },
    5000
  );
  const mutationResp = await query({
    ...subOpts,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 3,
      text: 'Jill'
    }
  });
  if (mutationResp && mutationResp.insert_graphqurl_test && mutationResp.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          console.log('Passed: Subscription with promise')
        } else {
          console.log('Failed: Subscription with promise');
        }
      },
      5000
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
        respLength = event.data.graphqurl.test;
      }
      else {
        console.log('Failed: Subscription with callback')
        console.log(event)
        process.exit(1);
      }
    },
    (error) => {
      console.log('Failed: Subscription with callback')
      console.log(error)
      process.exit(1)
    }
  )
  setTimeout(
    () => {
      if (respLength !== 0) {
        console.log('Failed: Subscription with callback');
        process.exit(1);
      }
    },
    5000
  );
  const mutationResp = await query({
    ...subOpts,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 4,
      text: 'Jack'
    }
  });
  if (mutationResp.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          console.log('Passed: Subscription with promise')
        } else {
          console.log('Failed: Subscription with promise')
        }
      },
      5000
    )
  }
}

module.exports = {
  testSubscriptionCallback,
  testSubscriptionPromise
}
