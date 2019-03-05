const query = require('./query');
const {Command, flags} = require('@oclif/command');
const {cli} = require('cli-ux');
const {CLIError} = require('@oclif/errors');
const fs = require('fs');
const url = require('url');
const util = require('util');
const {querySuccessCb, queryErrorCb} = require('./callbacks.js');
const getQueryFromTerminalUI = require('./ui');
const runGraphiQL = require('./graphiql/server');
const {introspectionQuery} = require('graphql');

// Convert fs.readFile into Promise version of same
const readFile = util.promisify(fs.readFile);

class GraphqurlCommand extends Command {
  async run() {
    const {args, flags} = this.parse(GraphqurlCommand);
    const headers = this.parseHeaders(flags.header);
    const endpoint = this.getEndpoint(args);
    let queryString = await this.getQueryString(args, flags);
    const variables = await this.getQueryVariables(args, flags);

    if (endpoint === null) {
      throw new CLIError('endpoint is required: `gq <endpoint>`');
    }

    const parsedEndpoint = url.parse(endpoint);
    if (!(parsedEndpoint.protocol && parsedEndpoint.host)) {
      throw new CLIError('endpoint is not a valid url');
    }

    if (flags.graphiql) {
      runGraphiQL(endpoint, queryString, headers, variables, flags.graphiqlAddress, flags.graphiqlPort);
      return;
    }

    if (flags.introspect) {
      queryString = introspectionQuery;
    }

    if (queryString === null) {
      queryString = await getQueryFromTerminalUI(endpoint, headers);
    }

    const queryOptions = {
      query: queryString,
      endpoint: endpoint,
      headers,
      variables,
      name: flags.name,
    };

    this.args = args;
    this.flags = flags;

    const successCallback = (response, queryType, parsedQuery) => {
      querySuccessCb(this, response, queryType, parsedQuery, endpoint);
    };
    const errorCallback = (error, queryType, parsedQuery) => {
      queryErrorCb(this, error, queryType, parsedQuery);
    };
    cli.action.start('Executing query');
    await query(queryOptions, successCallback, errorCallback);
  }

  parseHeaders(headersArray) {
    let headerObject = {};
    if (headersArray) {
      for (let h of headersArray) {
        const parts = h.split(':');
        if (parts.length !== 2) {
          this.error(`cannot parse header '${h}' (multiple ':')`);
        }
        headerObject[parts[0].trim()] = parts[1].trim();
      }
    }
    return headerObject;
  }

  getEndpoint(args) {
    if (args.endpoint) {
      return args.endpoint;
    }
    if (process.env.GRAPHQURL_ENDPOINT) {
      return process.env.GRAPHQURL_ENDPOINT;
    }
    return null;
  }

  async getQueryString(args, flags) {
    if (flags.queryFile) {
      const fileContent = await readFile(flags.queryFile);
      return fileContent;
    }
    if (flags.query) {
      return flags.query;
    }
    return null;
  }

  async getQueryVariables(args, flags) {
    let possibleFlags = [
      flags.variable,
      flags.variablesFile,
      flags.variablesJSON,
    ];
    let flagsCount = 0;
    for (const f of possibleFlags) {
      if (f) {
        flagsCount += 1;
      }
    }
    if (flagsCount > 1) {
      this.error('cannot use flags --variable, --variablesFile, --variablesJSON together');
    }
    let variablesObject = {};
    if (flags.variablesJSON) {
      try {
        variablesObject = JSON.parse(flags.variablesJSON);
      } catch (err) {
        this.error(`error parsing --variablesJSON: ${err}`);
      }
    }
    if (flags.variablesFile) {
      try {
        variablesObject = JSON.parse(await readFile(flags.variablesFile));
      } catch (err) {
        this.error(`error reading and parsing --variablesFile: ${err}`);
      }
    }
    if (flags.variable) {
      for (let v of flags.variable) {
        const parts = v.split('=');
        if (parts.length !== 2) {
          this.error(`cannot parse variable '${v} (multiple '=')`);
        }
        var val = parts[1].trim();
        try {
          val = JSON.parse(val);
        } catch (err) {
          // cannot parse as JSON. do nothing, proceed with raw value
        }
        variablesObject[parts[0].trim()] = val;
      }
    }
    return variablesObject;
  }
}

GraphqurlCommand.description = `GraphQURL: cURL for GraphQL
• Execute GraphQL queries from terminal
• Supports queries, mutations, subscriptions, with headers and variables
• Auto-complete queries on the CLI
• Launch GraphiQL (with headers UI) on any endpoint

# Examples:

# Make a simple query
gq https://my-graphql-endpoint -q 'query { table { column } }'

# Make a query with CLI auto complete (this will show a gql prompt)
gq https://my-graphql-endpoint

# Open GraphiQL
gq https://my-graphql-endpoint -i

# Add a custom header
gq https://my-graphql-endpoint \\
   -H 'Authorization: token token-value' \\
   -q 'query { table { column } }'

# Execute a mutation with variables
gq https://my-graphql-endpoint \\
   -q 'mutation { insert_table(objects:[{ column: $var }]) { returning { column } } }' \\
   -v 'var=abcd'

# Execute a live query (prints out each event data to stdout)
gq https://my-graphql-endpoint \\
   -q 'subscription { table { column } }'

# Execute a live query (print each event line by line)
gq https://my-graphql-endpoint \\
   -l -q 'subscription { table { column } }'

# Export GraphQL schema from an endpoint
gq https://my-graphql-endpoint --introspect > schema.gql
`;

GraphqurlCommand.usage = 'ENDPOINT [-q QUERY]';

GraphqurlCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version(),

  // add --help flag to show CLI version
  help: flags.help({char: 'h'}),

  // query for graphql
  query: flags.string({
    char: 'q',
    description: 'graphql query to execute',
  }),

  // headers, comma separated if they are many
  header: flags.string({
    char: 'H',
    description: 'request header',
    multiple: true,
  }),

  // variables for the query
  variable: flags.string({
    char: 'v',
    description: 'query variables as key=value',
    multiple: true,
  }),

  // variables for the query as JSON
  variablesJSON: flags.string({
    char: 'j',
    description: 'query variables as JSON string',
    multiple: false,
  }),

  // file to read query from
  queryFile: flags.string({
    description: 'file to read the query from',
  }),

  // file to read variables from
  variablesFile: flags.string({
    description: 'file to read the query variables from (JSON file)',
  }),

  // name of the query/mutation/subscription to execute
  name: flags.string({
    char: 'n',
    description: 'name of the graphql definition to execute, use only if there are multiple definitions',
  }),

  // run graphiql
  graphiql: flags.boolean({
    default: false,
    char: 'i',
    description: 'open graphiql with the given endpoint, headers, query and variables',
  }),

  // specify port to run graphiql at
  graphiqlAddress: flags.string({
    char: 'a',
    default: 'localhost',
    description: 'address to use for graphiql',
  }),
  // specify port to run graphiql at
  graphiqlPort: flags.integer({
    char: 'p',
    default: 4500,
    description: 'port to use for graphiql',
  }),

  // do not prettify the output
  singleLine: flags.boolean({
    char: 'l',
    default: false,
    description: 'show output in a single line, do not prettify',
  }),

  introspect: flags.boolean({
    default: false,
    description: 'introspect the endpoint and get schema',
  }),

  format: flags.string({
    description: 'output format for graphql schema after introspection',
    default: 'graphql',
    options: ['json', 'graphql'],
  }),
};

GraphqurlCommand.args = [
  {
    name: 'endpoint',
    description: 'graphql endpoint',
  },
];

module.exports = GraphqurlCommand;
