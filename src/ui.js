const tk = require('terminal-kit');
const xdg = require('@folder/xdg');
const path = require('path');
const crypto = require('crypto');
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

const suggestField = schema => inputString => {
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

const autocompletion = schema => {
  return {autoComplete: suggestField(schema), autoCompleteMenu: true};
};

const input = (schema, history, value) => {
  if (ib) {
    ib.abort();
  }
  let opts = {default: value, history, ...autocompletion(schema)};
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

const getValidQuery = async (schema, history, value) => {
  term('gql> ');
  const qs = await input(schema, history, value).promise;
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

const getQueryFromTerminalUI = (schema, history, value)  => {
  return getValidQuery(schema, history.slice(), value).catch(invalidStr => {
    if (exit) return Promise.resolve(undefined);

    return getQueryFromTerminalUI(schema, history, invalidStr);
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

const TWO_HOURS_MILLIS = 60 * 60 * 1000;

const getSchema = async (client, errorCb) => {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(client.options));

  cli.action.start('Introspecting schema');
  const introspectionOpts = {query: getIntrospectionQuery()};
  hash.update(JSON.stringify(introspectionOpts));
  let hex = hash.digest('hex');
  let cacheName = path.join(directories.cache, 'schema_' + hex + '.json');
  let stats = await promisify(fs.stat)(cacheName).catch(() => null);
  let r;

  if (stats && Date.now() - stats.mtime.getTime() <= TWO_HOURS_MILLIS) {
    let cached = await promisify(fs.readFile)(cacheName, 'utf8').catch(() => null);
    if (cached) {
      try {
        r = JSON.parse(cached);
      } catch (e) {
        fs.unlink(cacheName, () => {});
      }
    }
  }

  if (!r) {
    const schemaResponse = await client.query(introspectionOpts, null, errorCb);
    r = schemaResponse.data;

    fs.mkdir(directories.cache, {recursive: true}, err => {
      if (err) return;
      fs.writeFile(cacheName, JSON.stringify(r), 'utf8', err => {
        if (!err) return;
        console.warn('Could not write schema to cache file');
      });
    });
  }

  cli.action.stop('done');
  // term.fullscreen(true);
  return buildClientSchema(r);
};

const executeQueryFromTerminalUI = async (queryOptions, successCb, errorCb)  => {
  const {
    endpoint,
    headers,
  } = queryOptions;

  let client = makeClient({
    endpoint,
    headers,
  });

  let schema = await getSchema(client, errorCb);

  /* eslint-disable-next-line no-unmodified-loop-condition */
  let history = await loadHistory();

  console.log('Enter the query, use TAB to auto-complete, Enter to execute, Ctrl+C to cancel');
  let cancellation = new Promise((resolve, _) => {
    cancel = () => resolve(undefined);
  });

  let queryString;

  do {
    let promise = getQueryFromTerminalUI(schema, history);
    queryString = await Promise.race([promise, cancellation]);
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
