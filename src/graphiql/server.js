const Express = require('express');
const opn = require('opn');
const path = require('path');

const runGraphiQL = (endpoint, query, headers, variables, address, port) => {
  const graphiqlHtml = `
<html lang="en-us">
  <head>
    <link rel="icon" type="image/png" href="./favicon.png" />
    <script>
     window.__env = {
       graphqlEndpoint: "${endpoint}",
       headers: ${JSON.stringify(headers)},
       variables: ${JSON.stringify(variables)},
       query: \`${query || ''}\`
     };
    </script>
  </head>
  <body>
    <style>
    .mainContent {
      display: 'none';
      opacity: 0;
      transition: opacity .20s linear;
    }
    .mainContent.show {
      display: 'block';
      opacity: 1;
      transition: opacity .20s linear;
    }
    </style>

    <div id="loading">
      <div class="page-loading" style="
      min-height: 100vh;
      width: 100%;
      display: flex;
      align-items: center;
      font-family: sans-serif;
      justify-content: center;
      ">
        <span class="" style="
        font-size: 2em;
        margin-top: -3em;
        color: #848484;
        ">
        Loading...
      </span>
      </div>
    </div>
    <div id="content" class="mainContent"></div>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css"/>

    <link rel="stylesheet" href="/static/main.css" charset="UTF-8"/>
    <script src="/static/vendor.js" charset="UTF-8"></script>
    <script src="/static/main.js" charset="UTF-8"></script>

  </body>
</html>
`;
  const app = new Express();

  app.use('/static', Express.static(path.join(__dirname, 'app', 'static', 'dist')));

  app.get('/', (req, res) => {
    res.send(graphiqlHtml);
  });

  app.listen(port, address, () => {
    console.log(`GraphiQL running at http://${address}:${port}...`);
    opn(`http://${address}:${port}`);
  });
};

module.exports = runGraphiQL;
