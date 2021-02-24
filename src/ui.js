const _ = require('lodash');
const tk = require('terminal-kit');
const xdg = require('@folder/xdg');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const {promisify} = require('util');
const {GraphQLScalarType, GraphQLInputObjectType, getIntrospectionQuery, buildClientSchema, parse} = require('graphql');
const {cli} = require('cli-ux');
const {validateQuery, getAutocompleteSuggestions} = require('graphql-language-service-interface');
const {Position} = require('graphql-language-service-utils');
const makeClient = require('./client');
const query = require('./query.js');
const paths = require('./ui/paths.js');
const {indexSchema} = require('./ui/schema.js');

// FIXME: needs js idiomatic refactor eslint-disable-line no-warning-comments

const introspectionFile = path.join(__dirname, 'queries', 'introspection.graphql');

const KINDS = [
  'query', 'mutation', 'fragment', 'import',
  'let', 'help', paths.KIND, 'quit', 'reload-schema'
];

var term = tk.terminal;

let ib;
let cancel;
let fragments = [];
let variables = new Map();

const directories = xdg({subdir: 'graphqurl'});

const terminate = () => {
  if (ib) {
    ib.abort();
  }
  if (cancel) {
    cancel();
  }
  cancel = undefined;
  term.nextLine(1);
  term.grabInput(false);
  term.fullscreen(false);
};

const inputKind = inputString => {
  if (!inputString) {
    return undefined;
  }

  for (let kind of KINDS) {
    if (inputString.startsWith(kind)) {
      return kind;
    }
  }
}

function inputTypes(schema) {
  if (!schema.inputTypes) {
    let types = schema.getTypeMap();
    schema.inputTypes = Object.values(types).filter(type => {
      return (type instanceof GraphQLScalarType || type instanceof GraphQLInputObjectType);
    });
  }

  return schema.inputTypes;
}

const neverEmpty = f => x => {
  let xs = f(x);
  if (_.isEmpty(xs)) {
    return x;
  }
  return xs;
}

const suggest = ({schema, indexedSchema}) => neverEmpty(inputString => {
  switch (inputKind(inputString)) {
  case 'import':
    return suggestImports(inputString);
  case 'query':
    return suggestQueryField(schema, inputString);
  case 'mutation':
    return suggestQueryField(schema, inputString);
  case 'fragment':
    return suggestQueryField(schema, inputString);
  case 'let':
    return suggestVariables(schema, inputString);
  case paths.KIND:
    return paths.suggestPath(schema, indexedSchema, inputString);
  case 'help':
  case 'quit':
  case 'reload-schema':
    return inputString;
  }

  return KINDS.filter(k => _.isEmpty(inputString) || k.includes(inputString.toLowerCase()));
});

function suggestVariables(schema, inputString) {
  let completions;
  let tokens = inputString.split(/(\s+|\b)/).filter(s => {
    return (s !== '' && !/^\s+$/.test(s));
  });
  let endsWithSpace = inputString.endsWith(' ');

  if (tokens.length === 1) {
    completions = variables.keys().slice();
    completions.prefix = inputString
    return completions;
  } else if (tokens.length === 2 && !endsWithSpace) {
    let name = tokens[1];
    completions = [name + ' =', name + ' :'];
    for (let v of variables.keys()) {
      if (v.startsWith(name)) {
        completions.push(v);
      }
    }
    completions.prefix = 'let ';
    return completions;
  } else if (tokens.length === 2) {
    completions = [' =', ' :'];
    completions.prefix = tokens.join(' ');
    return completions;
  } else if (tokens.length === 3 && tokens[2] == ':') {
    completions = inputTypes(schema).map(t => t.name);
    completions.prefix = tokens.join(' ') + ' ';
    return completions;
  } else if (tokens.length === 4 && tokens[2] == ':') {
    if (endsWithSpace) {
      completions = ['='];
    } else {
      let type = tokens[3];
      let types = inputTypes(schema)
        .map(t => t.name)
        .filter(tn => tn.startsWith(type));
      tokens.pop();
      completions = [type + ' =', ...types];
    }
    completions.prefix = tokens.join(' ') + ' ';
    return completions;
  }
  return inputString;
}

function suggestImports(inputString) {
  // TODO!!

  return [];
}

function suggestQueryField(schema, inputString) {
  let position = ib.getCursorPosition();
  let qs = inputString.slice(0, position + 1);
  let p = new Position(position, 0);
  let closingBrackets = [nextBracket(qs)].filter(x => x);

  let items = closingBrackets.concat(getAutocompleteSuggestions(schema, qs, p).map(item => item.label));

  if (items.length === 0) {
    return inputString;
  }

  items.prefix = inputString.replace(/\w+$/, '');

  return items;
};

function nextBracket(queryString) {
  let bStack = [];
  for (let c of queryString) {
    if (c === '{' || c === '(' || c === '[') {
      bStack.push(c);
    }
    if (c === '}' || c === ')' || c === ']') {
      bStack.pop();
    }
  }
  let openBracket = bStack.pop();

  switch (openBracket) {
  case '{':
    return '}';
  case '(':
    return ')';
  case '[':
    return ']';
  }
  return undefined;
};

const autocompletion = schemas => {
  return {autoComplete: suggest(schemas), autoCompleteMenu: true};
};

// TODO: different inputs for each kind
const input = (schemas, history, value) => {
  if (ib) {
    ib.abort();
  }
  let opts = {default: value, history, ...autocompletion(schemas)};
  ib = term.inputField(opts);
  return ib.promise;
};

term.on('key', async function (key) {
  if (key === 'CTRL_D' || key === 'CTRL_C') {
    console.log('Goodbye!');
    terminate();
  }
});

function printState() {
  if (fragments.length > 0) {
    term(`Fragments: ${fragments.map(i => i.name).join(', ')}\n`);
  }
  if (variables.size > 0) {
    term.bold('Variables\n');
    let table = [['name', 'type', 'value']];
    for (let expr of variables.values()) {
      table.push([expr.name, expr.type, expr.value]);
    }
    term.table(table, {firstRowTextAttr: {bold: true}, width: 60, fit: true});
  }
}

const getValidQuery = async (schemas, history, value) => {
  printState();
  term('gql> ');
  const qs = await input(schemas, history, value);
  term('\n');

  let kind = inputKind(qs);
  let expr;

  switch (kind) {
  case 'help':
  case 'quit':
  case 'reload-schema':
    return {kind};
  case 'query':
  case 'mutation':
    expr = await queryExpression(qs, schemas.schema);
    reportErrors(kind, qs, expr.errors);
    return expr;
  case 'let':
    expr = letExpression(qs);
    reportErrors(kind, qs, expr.errors);
    return expr;
  case paths.KIND:
    expr = paths.typeExpression(schemas, qs);
    reportErrors(kind, qs, expr.errors);
    return expr;
  case 'fragment':
  case 'import':
    term.red(`Not implemented: ${kind}\n`); // TODO
    return {kind};
  }
  throw qs;
};

function letExpression(string) {
  const pattern = /let\s+(?<name>\w+)(\s*:\s*(?<type>\w+))?\s*=\s*(?<value>.+)/;
  const match = pattern.exec(string);

  if (!match) {
    return {kind: 'let', errors: [{message: 'Illegal let expression'}]};
  }

  const expr = {kind: 'let', ...match.groups};
  expr.value = expr.value.replace(/(^\s+|\s+$)/g, '');
  expr.parsed = expr.value;

  if (!expr.type) {
    if (/^\d+\.\d+$/.test(expr.value)) {
      expr.type = 'Float';
      expr.parsed = parseFloat(expr.value);
    } else if (/^\d+$/.test(expr.value)) {
      expr.type = 'Int';
      expr.parsed = parseInt(expr.value);
    } else if (/^".*"$/.test(expr.value)) {
      expr.type = 'String';
      expr.parsed = expr.value.replace(/(^"|"$)/g, '');
    } else if (/^(true|false)$/.test(expr.value)) {
      expr.type = 'Boolean';
      expr.parsed = expr.value === 'true';
    } else {
      expr.errors = [{message: `Cannot infer type of ${expr.value}`}];
    }
  }

  return expr;
}

function exprToString(expr) {
  switch (expr.kind) {
    case 'query':
    case 'mutation':
      return expr.input;
    case 'let':
      return `let ${expr.name} : ${expr.type} = ${expr.value}`;
    case paths.KIND:
      return expr.asInputString();
  }
}

function reportErrors(kind, string, errors) {
  if (!errors) {
    return;
  }
  if (errors.length > 0) {
    term.bold(`Invalid ${kind}\n`);
    errors.forEach(e => {
      term.red(e.message + '\n');
    });
    throw string;
  }
}

async function queryExpression(queryString, schema) {
  let errors;
  try {
    errors = await validateQuery(parse(queryString), schema);
  } catch (e) {
    errors = [e];
  }
  return {kind: 'query', input: queryString, errors};
}

const getQueryFromTerminalUI = (schemas, history, value)  => {
  return getValidQuery(schemas, history.slice(), value).catch(invalidStr => {
    return getQueryFromTerminalUI(schemas, history, invalidStr);
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

const getSchema = async (client, errorCb, useCache = true) => {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(client.options));

  cli.action.start('Introspecting schema');
  const queryString = await promisify(fs.readFile)(introspectionFile, 'utf8');
  // const introspectionOpts = {query: getIntrospectionQuery()};
  const introspectionOpts = {query: queryString};
  hash.update(JSON.stringify(introspectionOpts));
  let hex = hash.digest('hex');
  let cacheName = path.join(directories.cache, 'schema_' + hex + '.json');
  let stats = await promisify(fs.stat)(cacheName).catch(() => null);
  let r;

  if (useCache && stats && Date.now() - stats.mtime.getTime() <= TWO_HOURS_MILLIS) {
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
  return r;
};

function printHelp() {
  term.bold('Commands:\n')

  term.table([
    [ 'query {..}', 'Run a query' ],
    [ 'mutation {..}', 'Run a mutation' ],
    [ 'let [name] : [type] = [value]', 'Define a variable' ],
    [ 'fragment [name] on [type] { .. }', 'Define a fragment' ],
    [ 'import [file]', 'Import fragments from a file' ],
    [ 'type [path]', 'Get type information about a path' ],
    [ 'help', 'Print this help information' ]
  ], {width: 72});
}

const executeQueryFromTerminalUI = async (queryOptions, successCb, errorCb)  => {
  const {
    endpoint,
    headers,
  } = queryOptions;

  if (queryOptions.variables) {
    for (let k in queryOptions.variables) {
      let v = queryOptions.variables
      if (_.isString(v)) {
        variables.set(k, {kind: 'let', type: 'String', value: `"${v}"`, parsed: v});
      } else if (Number.isInteger(v)) {
        variables.set(k, {kind: 'let', type: 'Int', value: `${v}`, parsed: v});
      } else if (typeof v === 'number') {
        variables.set(k, {kind: 'let', type: 'Float', value: `${v}`, parsed: v});
      } else if (v === true || v === false) {
        variables.set(k, {kind: 'let', type: 'Boolean', value: `${v}`, parsed: v});
      } else {
        variables.set(k, {kind: 'let', type: 'Unknown', value: JSON.stringify(v), parsed: v});
      }
    }
  }

  let client = makeClient({
    endpoint,
    headers,
  });

  let rawSchema = await getSchema(client, errorCb).catch(e => {
    term.red(`Could not fetch schema from ${endpoint}\n`);
    e.errors.forEach(e => term(e.message + '\n'));
    throw e;
  });
  let schema = buildClientSchema(rawSchema);

  /* eslint-disable-next-line no-unmodified-loop-condition */
  let history = await loadHistory();

  console.log('Enter the query, use TAB to auto-complete, Enter to execute, Ctrl+C to cancel');
  let cancellation = new Promise((resolve, _) => {
    cancel = () => resolve({kind: 'quit'});
  });

  let loop = true;

  while (loop) {
    let schemas = {schema, indexedSchema: indexSchema(rawSchema)};
    let promise = getQueryFromTerminalUI(schemas, _.uniq(history));
    res = await Promise.race([promise, cancellation]);
    switch (res.kind) {
    case 'quit':
      loop = false;
      terminate();
      break;
    case 'reload-schema':
      let newSchema = await getSchema(client, errorCb, false).catch(e => {
        term.red(`Could not fetch schema from ${endpoint}\n`);
        e.errors.forEach(e => term(e.message + '\n'));
      });
      if (newSchema) {
        rawSchema = newSchema;
        schema = buildClientSchema(newSchema);
      }
      break;
    case 'help':
      printHelp();
      break;
    case 'query':
    case 'mutation':
      history.push(exprToString(res));
      cli.action.start('Waiting');
      let vars = _.fromPairs(Array.from(variables).map(([k, defn]) => [k, defn.parsed]))
      await query({query: res.input, variables: vars, endpoint, headers}, successCb, errorCb);
      cli.action.stop('done');
      break;
    case 'let':
      history.push(exprToString(res));
      variables.set(res.name, res);
      break;
    case paths.KIND:
      history.push(exprToString(res));
      res.render(term);
      break;
    }
  }

  writeHistory(_.uniq(history));
};

module.exports = executeQueryFromTerminalUI
