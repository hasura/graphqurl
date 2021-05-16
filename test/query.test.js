const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080';
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345';

const testQueryPromise = async client => {
  const queryOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `query ($id:Int) {
      graphqurl_test(where: { id: { _eq: $id} }){
        text
      }
    }`,
    variables: {
      id: 1,
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  };
  let response;
  try {
    response = await client.query(queryOpts);
    if (response.data.graphqurl_test.length === 1) {
      console.log('✔︎ Query with promise');
    } else {
      console.log('✖ Query with promise');
      console.log(JSON.stringify(response, null, 2));
      process.exit('1');
    }
  } catch (e) {
    console.log('✖ Query with promise');
    console.error(e);
    process.exit(1);
  }
};

const testQueryCallback = async client => {
  const queryOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `query ($id:Int) {
      graphqurl_test(where: { id: { _eq: $id} }){
        text
      }
    }`,
    variables: {
      id: 1,
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  };
  let respLength;
  await client.query(
    queryOpts,
    resp => {
      respLength = resp.data.graphqurl_test.length;
    },
    error => {
      console.log('✖ Query with callback');
      console.log(error);
      process.exit(1);
    },
  );
  setTimeout(
    () => {
      if (respLength === 1) {
        console.log('✔︎ Query with callback');
      } else {
        console.log('✖ Query with callback');
      }
    },
    5000,
  );
};

module.exports = {
  testQueryPromise,
  testQueryCallback,
};
