const tk = require('terminal-kit');
const xdg = require('@folder/xdg');
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');
const {getIntrospectionQuery, buildClientSchema, parse} = require('graphql');
const {cli} = require('cli-ux');
const {validateQuery, getAutocompleteSuggestions} = require('graphql-language-service-interface');
const {Position} = require('graphql-language-service-utils');
const makeClient = require('./client');
const query = require('./query.js');

// FIXME: needs js idiomatic refactor eslint-disable-line no-warning-comments

var term = tk.terminal;

let ib;
let cancel;
let schema;
let exit = false;

const directories = xdg({subdir: 'graphqurl'});

const terminate = () => {
  if (ib) {
    ib.abort();
  }
  if (cancel) {
    cancel();
  }
  term.nextLine(1);
  term.grabInput(false);
  term.fullscreen(false);
};

const suggestField = inputString => {
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

  if (items.length === 0) {
    return inputString;
  }

  items.prefix = inputString.replace(/\w+$/, '');

  return items;
};

const autocompletion = {autoComplete: suggestField, autoCompleteMenu: true};

const input = (history, value) => {
  if (ib) {
    ib.abort();
  }
  let opts = {default: value, history, ...autocompletion};
  ib = term.inputField(opts);
  return ib;
};

term.on('key', async function (key) {
  if (key === 'CTRL_D' || key === 'CTRL_C') {
    exit = true;
    console.log('Goodbye!');
    terminate();
  }
});

const getValidQuery = async (history, value) => {
  term('gql> ');
  const qs = await input(history, value).promise;
  let errors;

  try {
    errors = await validateQuery(parse(qs), schema);
  } catch (e) {
    errors = [e];
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

const getQueryFromTerminalUI = (history, value)  => {
  return getValidQuery(history.slice(), value).catch(invalidStr => {
    if (exit) return Promise.resolve(undefined);

    return getQueryFromTerminalUI(history, invalidStr);
  });
};

const historyFile = path.join(directories.config, 'history');

const writeHistory = history => {
  if (history.length > 0) {
    fs.mkdir(directories.config, {recursive: true}, err => {
      if (err) return;

      fs.writeFile(historyFile, history.join('\n'), 'utf8', err => {
        if (!err) return;
        console.warn('Could not write history file');
      });
    });
  }
};

const loadHistory = async () => {
  try {
    let fileContent = await promisify(fs.readFile)(historyFile, 'utf8');
    return fileContent.split('\n');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(e);
    }
    return [];
  }
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

  /* eslint-disable-next-line no-unmodified-loop-condition */
  let history = await loadHistory();

  console.log('Enter the query, use TAB to auto-complete, Enter to execute, Ctrl+C to cancel');
  let cancellation = new Promise((resolve, _) => {
    cancel = () => resolve(undefined);
  });

  let queryString;

  do {
    queryString = await Promise.race([getQueryFromTerminalUI(history), cancellation]);
    if (queryString) {
      history.push(queryString);
      cli.action.start('Waiting');
      await query({query: queryString, endpoint, headers}, successCb, errorCb);
      cli.action.stop('done');
    }
  } while (queryString);

  writeHistory(history);
};

module.exports = executeQueryFromTerminalUI;
