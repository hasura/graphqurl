const Query = require('./query');
const {Command, flags} = require('@oclif/command');
const {cli} = require('cli-ux');
const fs = require('fs');
const util = require('util');

// Convert fs.readFile into Promise version of same
const readFile = util.promisify(fs.readFile);

class GraphqurlCommand extends Command {
  async run() {
    const {args, flags} = this.parse(GraphqurlCommand);
    // this.log(`query: ${args.query}`);
    // this.log(`endpoint: ${flags.endpoint}`);
    // this.log(`header: ${flags.header}`);
    // this.log(`variable: ${flags.variable}`);

    const headers = this.parseHeaders(flags.header);
    const queryString = await this.getQueryString(args, flags);
    const variables = await this.getQueryVariables(args, flags);

    if (queryString == null) {
      this.error('pass a query as an argument or as a file (--queryFile)');
    }

    cli.action.start(`Executing on ${flags.endpoint}`);
      let result = await Query(this, flags.endpoint, headers, queryString, variables, flags.name);
    cli.action.stop();
    this.log(JSON.stringify(result, null, 2));
  }

  parseHeaders(headersArray) {
    let headerObject = {};
    if (headersArray) {
      for (let h of headersArray) {
        const parts = h.split(':');
        if (parts.length != 2) {
          this.error(`cannot parse header '${h}' (multiple ':')`);
        }
        headerObject[parts[0].trim()] = parts[1].trim();
      }
    }
    return headerObject;
  }

  async getQueryString(args, flags) {
    if (flags.queryFile) {
      return await readFile(flags.queryFile);
    }
    if (args.query) {
      return args.query;
    }
    return null;
  }

  async getQueryVariables(args, flags) {
    let variablesObject = {};
    if (flags.variablesFile) {
      variablesObject = JSON.parse(await readFile(flags.variablesFile));
    }
    if (flags.variable) {
      for (let v of flags.variable) {
        const parts = v.split('=');
        if (parts.length != 2) {
          this.error(`cannot parse variable '${v} (multiple '=')`);
        }
        variablesObject[parts[0].trim()] = parts[1].trim();
      }
    }
    return variablesObject;
  }
}

GraphqurlCommand.description = `GraphQURL is cURL for GraphQL
gq \\
  --endpoint https://my-graphql-endpoint/graphql \\
  -H 'Authorization: token <token>' \\
  -H 'X-Another-Header: another-header-value' \\
  -v 'variable1=value1' \\
  -v 'variable2=value2' \\
  'query { table { column } }'
`;

GraphqurlCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version(),

  // add --help flag to show CLI version
  help: flags.help({char: 'h'}),

  // endpoint for graphql
  endpoint: flags.string({
    char: 'e',
    required: true,
    description: 'graphql endpoint to run the query',
    env: 'GRAPHQURL_ENDPOINT'
  }),

  // headers, comma separated if they are many
  header: flags.string({
    char: 'H',
    description: 'request header',
    multiple: true
  }),

  // variables for the query
  variable: flags.string({
    char: 'v',
    description: 'variables used in the query',
    multiple: true
  }),

  // file to read query from
  queryFile: flags.string({
    description: 'file to read the query from'
  }),

  // file to read variables from
  variablesFile: flags.string({
    description: 'file to read the variables from'
  }),

  // name of the query/mutation/subscription to execute
  name: flags.string({
    char: 'n',
    description: 'name of the graphql definition to execute, use only if there are multiple definitions'
  })
};

GraphqurlCommand.args = [
  {
    name: 'query',
    description: 'graphql query as a string'
  }
];

module.exports = GraphqurlCommand;
