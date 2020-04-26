const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080';
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345';

const testSubscriptionPromise = async client => {
  const subOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    subscription: `subscription ($id:Int) {
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
  };
  let respLength = null;
  client.subscribe(
    subOpts,
    event => {
      if (event.data && event.data.graphqurl_test) {
        respLength = event.data.graphqurl_test.length;
      } else {
        console.log('✖ Subscription with promise');
        console.log(JSON.stringify(event, null, 2));
        process.exit(1);
      }
    },
    error => {
      console.log('✖ Subscription with promise');
      console.log(JSON.stringify(error, null, 2));
      process.exit(1);
    }
  );
  const mutationResp = await client.query({
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
  });
  if (mutationResp.data.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          console.log('✔︎ Subscription with promise');
        } else {
          console.log('✖ Subscription with promise');
          console.log('Mutation did not trigger an event', respLength);
        }
      },
      15000
    );
  }
};

const testSubscriptionCallback = async client => {
  const subOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    subscription: `subscription ($id:Int) {
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
  };
  let respLength = null;
  await client.subscribe(
    subOpts,
    event => {
      if (event.data && event.data.graphqurl_test) {
        respLength = event.data.graphqurl_test.length;
      } else {
        console.log('✖ Subscription with callback');
        console.log(JSON.stringify(event, null, 2));
        process.exit(1);
      }
    },
    error => {
      console.log('✖ Subscription with callback');
      console.log(JSON.stringify(error, null, 2));
      process.exit(1);
    }
  );
  const mutationResp = await client.query({
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
  });
  if (mutationResp.data.insert_graphqurl_test.affected_rows === 1) {
    setTimeout(
      () => {
        if (respLength === 1) {
          console.log('✔︎ Subscription with callback');
          process.exit(0);
        } else {
          console.log('✖ Subscription with callback');
        }
      },
      15000
    );
  }
};

module.exports = {
  testSubscriptionCallback,
  testSubscriptionPromise,
};
