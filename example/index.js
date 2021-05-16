const {createClient} = require('..');

const client = createClient({
  endpoint: 'https://graphqurl-demo.hasura.app/v1/graphql',
});

console.dir("Executing query 'query { menu_items { name } }': ");
client.query(
  {
    query: 'query { menu_items { name } }',
  },
).then(response => console.log(JSON.stringify(response)))
.catch(error => console.error(error));

console.dir("Executing mutation: 'mutation {delete_menu_items(where: {name: {_eq: \"pasta\"}}){ returning { name }}}'");
client.query(
  {
    query: 'mutation ($name: String) {delete_menu_items(where: {name: {_eq: $name}}) {returning {name}}}',
    variables: {name: 'pizza'},
  },
).then(() => console.log('Successfully executed delete mutation.'))
.catch(error => console.error(error));

console.dir("Executing insert mutation: 'mutation {insert_menu_items(objects: {name: \"pasta\",}) {returning {name}}}'");
client.query(
  {
    query: 'mutation ($name: String) {insert_menu_items(objects: {name: $name}) {returning {name}}}',
    variables: {
      name: 'pasta',
    },
  },
).then(() => console.log('Successfully executed insert mutation'))
.catch(error => console.error(error));
