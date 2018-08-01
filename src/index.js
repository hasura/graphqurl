const query = require('./query')
const {Command, flags} = require('@oclif/command')
const {cli} = require('cli-ux')
const fs = require('fs')
const util = require('util')
const {querySuccessCb, queryErrorCb} = require('./callbacks.js')
const getQueryFromTerminalUI = require('./ui')

// Convert fs.readFile into Promise version of same
const readFile = util.promisify(fs.readFile)

class GraphqurlCommand extends Command {
  async run() {
    const {args, flags} = this.parse(GraphqurlCommand)
    // this.log(`query: ${args.query}`);
    // this.log(`endpoint: ${flags.endpoint}`);
    // this.log(`header: ${flags.header}`);
    // this.log(`variable: ${flags.variable}`);

    const headers = this.parseHeaders(flags.header)
    let queryString = await this.getQueryString(args, flags)
    const variables = await this.getQueryVariables(args, flags)

    if (queryString === null) {
      queryString = await getQueryFromTerminalUI(flags.endpoint, headers)
      // this.log(queryString);
    }
    const queryOptions = {
      query: queryString,
      endpoint: flags.endpoint,
      headers,
      variables,
      name: flags.name,
    }
    const successCallback = (response, queryType, parsedQuery) => {
      querySuccessCb(this, response, queryType, parsedQuery, flags.endpoint)
    }
    const errorCallback = (error, queryType, parsedQuery) => {
      queryErrorCb(this, error, queryType, parsedQuery)
    }
    cli.action.start(`Executing at ${flags.endpoint}`)
    await query(queryOptions, successCallback, errorCallback)
  }

  parseHeaders(headersArray) {
    let headerObject = {}
    if (headersArray) {
      for (let h of headersArray) {
        const parts = h.split(':')
        if (parts.length !== 2) {
          this.error(`cannot parse header '${h}' (multiple ':')`)
        }
        headerObject[parts[0].trim()] = parts[1].trim()
      }
    }
    return headerObject
  }

  async getQueryString(args, flags) {
    if (flags.queryFile) {
      const fileContent = await readFile(flags.queryFile)
      return fileContent
    }
    if (args.query) {
      return args.query
    }
    return null
  }

  async getQueryVariables(args, flags) {
    let variablesObject = {}
    if (flags.variablesFile) {
      variablesObject = JSON.parse(await readFile(flags.variablesFile))
    }
    if (flags.variable) {
      for (let v of flags.variable) {
        const parts = v.split('=')
        if (parts.length !== 2) {
          this.error(`cannot parse variable '${v} (multiple '=')`)
        }
        variablesObject[parts[0].trim()] = parts[1].trim()
      }
    }
    return variablesObject
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
`

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
    env: 'GRAPHQURL_ENDPOINT',
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
    description: 'variables used in the query',
    multiple: true,
  }),

  // file to read query from
  queryFile: flags.string({
    description: 'file to read the query from',
  }),

  // file to read variables from
  variablesFile: flags.string({
    description: 'file to read the variables from',
  }),

  // name of the query/mutation/subscription to execute
  name: flags.string({
    char: 'n',
    description: 'name of the graphql definition to execute, use only if there are multiple definitions',
  }),
}

GraphqurlCommand.args = [
  {
    name: 'query',
    description: 'graphql query as a string',
  },
]

module.exports = GraphqurlCommand
