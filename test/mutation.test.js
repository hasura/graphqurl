const query = require('..')
const hgeUrl = process.env.GRAPHQURL_TEST_GRAPHQL_ENGINE_URL || 'http://localhost:8080'
const accessKey = process.env.GRAPHQURL_TEST_X_HASURA_ACCESS_KEY || '12345'

const testMutationPromise = async () => {
  const mutationOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 1,
      text: 'Bob',
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  }
  let response
  try {
    response = await query(mutationOpts)
    if (response.data.insert_graphqurl_test.affected_rows === 1) {
      console.log('Passed: Mutation with promise')
    } else {
      console.log('Failed: Mutation with promise')
      console.log(JSON.stringify(response, null, 2))
      process.exit('1')
    }
  } catch (e) {
    console.log('Failed: Mutation with promise')
    console.error(e)
    process.exit(1)
  }
}

const testMutationCallback = async () => {
  const mutationOpts = {
    endpoint: `${hgeUrl}/v1alpha1/graphql`,
    query: `mutation($id:Int, $text:String) {
      insert_graphqurl_test(objects:[{id: $id, text:$text}]){
        affected_rows
      }
    }`,
    variables: {
      id: 2,
      text: 'Alice',
    },
    headers: {
      'x-hasura-access-key': accessKey,
    },
  }
  let affectedRows
  await query(
    mutationOpts,
    resp => {
      affectedRows = resp.data.insert_graphqurl_test.affected_rows
    },
    error => {
      console.log('Failed: Mutation with callback')
      console.log(error)
      process.exit(1)
    }
  )
  setTimeout(
    () => {
      if (affectedRows === 1) {
        console.log('Passed: Mutation with callback')
      } else {
        console.log('Failed: Mutation with callback')
      }
    },
    5000
  )
}

module.exports = {
  testMutationPromise,
  testMutationCallback,
}
