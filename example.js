const {createClient} = require('graphqurl');

const client = createClient({
  endpoint: 'http://schema-stitching-blog.herokuapp.com/v1/graphql',
});

console.dir("Executing query 'query { game { id ip multiplayer name type } }': ");
client.query(
  {
    query: 'query { game { id ip multiplayer name type } }',
  }
).then(response => console.dir(response))
.catch(error => console.error(error));

console.dir("Executing mutation: 'mutation {delete_game(where: {id: {_eq: 2}}) {returning {id ip multiplayer name type}}}'");
client.query(
  {
    query: 'mutation ($id: Int) {delete_game(where: {id: {_eq: $id}}) {returning {id ip multiplayer name type}}}',
    variables: {id: 1},
  }
).then(() => console.dir('Successfully executed delete mutation.'))
.catch(error => console.error(error));

console.dir("Executing insert mutation: 'mutation {insert_game(objects: {id: 1, ip: \"10.11.12.13:27015\", multiplayer: true, name: \"DotA\", type: \"Strategy\"}) {returning {id ip multiplayer name type}}}'");
client.query(
  {
    query: 'mutation ($id: Int, $ip: String, $multiplayer: Boolean, $name: String, $type: String) {insert_game(objects: {id: $id, ip: $ip, multiplayer: $multiplayer, name: $name, type: $type}) {returning {id ip multiplayer name type}}}',
    variables: {
      id: 1,
      ip: '10.11.12.13:27015',
      multiplayer: true,
      name: 'DotA',
      type: 'Strategy',
    },
  }
).then(() => console.dir('Successfully executed insert mutation'))
.catch(error => console.error(error));
