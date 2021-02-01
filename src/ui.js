const tk = require('terminal-kit');
const {getIntrospectionQuery, buildClientSchema, parse} = require('graphql');
const {cli} = require('cli-ux');
const {validateQuery, getAutocompleteSuggestions} = require('graphql-language-service-interface');
const {Position} = require('graphql-language-service-utils');
const makeClient = require('./client');
const query = require('./query.js');

// FIXME: needs js idiomatic refactor eslint-disable-line no-warning-comments

var term = tk.terminal;

let ib;
let schema;
let exit = false;

const terminate = error => {
  term.nextLine(1);
  term.grabInput(false);
  term.fullscreen(false);
};

const input = (history, value) => {
  if (ib) {
    ib.abort();
  }
  let opts = { default: value, ...inputOpts(history) };
  ib = term.inputField(opts);
  return ib;
}

const suggestField = (inputString) => {
  let position = ib.getCursorPosition();
  let bStack = [];
  let qs = inputString.slice(0, position + 1);
  let p = new Position(position, 0);

  for (let c of qs) {
    if (c === '{' || c === '(' || c === '[') {
      bStack.push(c);
    }
    if (c === '}' || c === ')' || c === ']') {
      bStack.pop();
    }
  }
  let items = getAutocompleteSuggestions(schema, qs, p).map(item => item.label);

  let bStackACS = bStack.map(c => {
    switch (c) {
    case '{':
      return '}';
    case '(':
      return ')';
    case '[':
      return ']';
    }
    return undefined;
  });

  if (bStackACS.length > 0) {
    items.unshift(bStackACS[bStackACS.length - 1]);
  }

  if (items.length == 0) { 
    return inputString;
  }

  items.prefix = inputString.replace(/\w+$/, '');

  return items;
}

const inputOpts = (history) => {
  return {
    history: history,
    autoComplete: suggestField,
    autoCompleteMenu: true
  };
};

term.on('key', async function (key) {
  if (key === 'CTRL_C') {
    terminate('cancelled');
  }
  if (key === 'CTRL_D') {
    console.log('Goodbye!');
    terminate('cancelled');
  }
});

const getQueryFromTerminalUI = (history, value)  => {
  return getValidQuery(history, value).catch(invalidStr => {
    return getQueryFromTerminalUI(history, invalidStr)
  });
};

const getValidQuery = async (history, value) => {
  term('gql> ');
  const qs = await input(history, value).promise;
  let errors;

  try {
    errors = await validateQuery(parse(qs), schema);
  } catch(e) {
    errors = [e]
  }

  if (errors.length > 0) { 
    term.nextLine(1);
    term.bold('Invalid query\n');
    errors.forEach(e => {
      term.red(e.message + '\n');
    });
    throw qs;
  }

  return qs;
};

const executeQueryFromTerminalUI = async (queryOptions, successCb, errorCb)  => {
  const {
    endpoint,
    headers,
  } = queryOptions;
  cli.action.start('Introspecting schema');
  let client = makeClient({
    endpoint,
    headers,
  });
  const introspectionOpts = {query: getIntrospectionQuery()};
  const schemaResponse = await client.query(introspectionOpts, null, errorCb);
  cli.action.stop('done');
  const r = schemaResponse.data;
  // term.fullscreen(true);
  schema = buildClientSchema(r);
  console.log('Enter the query, use TAB to auto-complete, Ctrl+Q / Enter to execute, Ctrl+C to cancel');

  /* eslint-disable-next-line no-unmodified-loop-condition */
  const history = [];
  while (!exit) {
    /* eslint-disable-next-line no-await-in-loop */
    const queryString = await getQueryFromTerminalUI(history.slice());
    history.push(queryString);
    cli.action.start('Waiting');
    await query({query: queryString, endpoint, headers}, successCb, errorCb);
    cli.action.stop('done');
  }
};

module.exports = executeQueryFromTerminalUI;
