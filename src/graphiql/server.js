const Express = require('express');
const { graphiqlExpress } = require('apollo-server-express');
const open = require('open');

const runGraphiQL = (endpoint, port = 4500) => {
  const app = new Express();

  app.use('/', graphiqlExpress({endpointURL: endpoint}));

  app.listen(port, () => {
    console.log(`GraphiQL running at http://localhost:${port}.`);
    open(`http://localhost:${port}`);
  });
};

module.exports = runGraphiQL;
