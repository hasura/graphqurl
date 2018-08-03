## Usage of Environment Variables

This app uses a few environment variables which are required for development. The production build uses values directly injected by the server serving this app.

We use [dotenv](https://github.com/motdotla/dotenv) for setting environment variables for development. Create a `.env' file in the root directory (wherever package.json is) and set the following values. Replace accordingly for testing.

```
PORT=3000
NODE_ENV=development
GRAPHQL_ENDPOINT=http://localhost:8090/v1alpha1/graphql
HEADER_STRING='{}'
VARIABLE_STRING='{}'
QUERY_STRING='query { test_table { id } }'
```

**Note**
The .env file should not be in version control.
