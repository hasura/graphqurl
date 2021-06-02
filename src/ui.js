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

/* we have a custom implementation of input field, since it is not easily extensible */
const inputField = require('./ui/input-field.js');

// FIXME: needs js idiomatic refactor eslint-disable-line no-warning-comments

const introspectionFile = path.join(__dirname, 'queries', 'introspection.graphql');

const KINDS = [
  'query', 'mutation', 'fragment', 'import',
  'let', 'help', paths.KIND, 'quit', 'reload-schema'
];

var term = tk.terminal;

let ib;
let cancel;
let goBack;
let fragments = [];
let lines = [];
let reprintInput = false;
let variables = new Map();

const directories = xdg({subdir: 'graphqurl'});

const terminate = () => {
  if (ib) {
    ib.abort();
    ib = null;
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

const suggest = ({schema, indexedSchema}) => neverEmpty(currentLine => {
  let prefix = [...lines, ''].join('\n');
  let inputString = [...lines, currentLine].join('\n');

  switch (inputKind(inputString)) {
  case 'import':
    return suggestImports(inputString);
  case 'query':
  case 'mutation':
  case 'fragment':
    return suggestQueryField(schema, inputString, prefix.length);
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

function suggestQueryField(schema, inputString, offset) {
  let position = ib.getCursorPosition();
  let qs = inputString.replace(/\n/g, ' ').slice(0, position + offset + 1);
  let p = new Position(position, 0);
  let closingBrackets = [nextBracket(qs)].filter(x => x);

  let items = closingBrackets.concat(getAutocompleteSuggestions(schema, qs, p).map(item => item.label));
  let lastLine = /\n/.test(inputString) ? inputString.split(/\n/).pop() : inputString;

  if (items.length === 0) {
    return lastLine;
  }

  items.prefix = lastLine.replace(/\w+$/, '');

  return items;
};

function nextBracket(queryString) {
  let bStack = bracketStack(queryString);
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

function openBracketCount(queryString) {
  return bracketStack(queryString).length;
}

function bracketStack(queryString) {
  let bStack = [];
  for (let c of queryString) {
    if (c === '{' || c === '(' || c === '[') {
      bStack.push(c);
    }
    if (c === '}' || c === ')' || c === ']') {
      bStack.pop();
    }
  }
  return bStack;
}

const autocompletion = schemas => {
  return {autoComplete: suggest(schemas), autoCompleteMenu: { selectedStyle: term.dim.black.bgWhite} };
};

// TODO: different inputs for each kind
const input = (schemas, history, value) => {
  if (ib) {
    ib.abort();
  }
  let opts = {default: value, history, ...autocompletion(schemas)};
  ib = inputField.call(term, opts);
  return ib.promise;
};

term.on('key', async function (key) {
  switch (key) {
  case 'CTRL_D':
  case 'CTRL_C':
    console.log('Goodbye!');
    terminate();
  case 'BACKSPACE':
    if (ib) {
      let currentLine = ib.getInput();
      if (_.isEmpty(currentLine)) {
        if (goBack) goBack();
        ib.abort();
        ib = null;
      }
    }
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

function showPrompt() {
  if (_.isEmpty(lines)) {
    printState();
    term('gql> ');
  } else {
    if (reprintInput) {
      printState();
      lines.forEach((line, i) => {
        let prmpt = i == 0 ? 'gql' : '...';
        term(`${prmpt}> ${line}\n`);
      });
      reprintInput = false;
    }
    term('...> ');
  }
}

const getValidQuery = async (schemas, history, value) => {
  showPrompt();

  const qs = await input(schemas, history, value);
  term('\n');

  let kind = inputKind([...lines, qs].join('\n'));
  let expr;

  switch (kind) {
  case 'help':
  case 'quit':
  case 'reload-schema':
    return {kind};
  case 'query':
  case 'mutation':
    expr = await queryExpression(qs, schemas.schema);
    if (expr.indentLevel > 0) {
      reprintInput = false;
      lines.push(qs);
      throw _.repeat('  ', expr.indentLevel);
    } else {
      reportErrors(kind, qs, expr.errors);
    }
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
  const pattern = /let\s+(?<name>\w+)(\s*:\s*(?<type>\w+!?))?\s*=\s*(?<value>.+)/;
  const match = pattern.exec(string);

  if (!match) {
    return {kind: 'let', errors: [{message: 'Illegal let expression'}]};
  }

  const expr = {kind: 'let', ...match.groups};
  expr.value = expr.value.replace(/(^\s+|\s+$)/g, '');
  expr.parsed = expr.value;

  if (expr.type) {
    if (/^".*"$/.test(expr.value)) {
      expr.parsed = expr.value.replace(/(^"|"$)/g, '');
    }
  } else {
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
    reprintInput = true;
    throw string;
  }
}

function querySignature(vars) {
  return Array
    .from(variables)
    .filter(([k, _]) => vars.has('$' + k))
    .map(([k, defn]) => `$${k}: ${defn.type}`)
    .join(', ');
}

async function queryExpression(currentLine, schema) {
  let errors;
  let queryString = [...lines, currentLine].join('\n');
  try {
    if (/^(query|mutation)\s*{/.test(queryString) && variables.size > 0) {
      let vars = new Set([...queryString.matchAll(/\$\w+/g)].map(m => m[0]));
      if (vars.size > 0) {
        queryString = queryString.replace(/^(query|mutation)/, (match) => {
          return `${match}(${querySignature(vars)})`;
        });
      }
    }
    errors = await validateQuery(parse(queryString), schema);
  } catch (e) {
    errors = [e];
  }
  let indentLevel = openBracketCount(queryString);
  return {kind: 'query', input: queryString, indentLevel, errors};
}

const getQueryFromTerminalUI = (schemas, history, value)  => {
  return getValidQuery(schemas, history.slice(), value).catch(invalidStr => {
    return getQueryFromTerminalUI(schemas, history, invalidStr);
  });
};

const historyFile = path.join(directories.config, 'history.json');

const writeHistory = history => {
  if (history.length > 0) {
    fs.mkdir(directories.config, {recursive: true}, err => {
      if (err) return;

      fs.writeFile(historyFile, JSON.stringify(history), 'utf8', err => {
        if (!err) return;
        console.warn('Could not write history file');
      });
    });
  }
};

const loadHistory = async () => {
  try {
    let fileContent = await promisify(fs.readFile)(historyFile, 'utf8');
    return JSON.parse(fileContent);
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
  let currentLine;

  while (loop) {
    let prevLine = new Promise((resolve, _) => {
      goBack = () => resolve({kind: 'previous-line'});
    });

    let schemas = {schema, indexedSchema: indexSchema(rawSchema)};
    let promise = getQueryFromTerminalUI(schemas, _.uniq(history), currentLine);
    res = await Promise.race([promise, cancellation, prevLine]);
    currentLine = undefined;
    switch (res.kind) {
    case 'quit':
      loop = false;
      terminate();
      break;
    case 'previous-line':
      if (lines.length > 0) {
        let previous = lines.pop();
        currentLine = previous;
        term.eraseLine();
        term.previousLine(lines.length + 1);
        reprintInput = true;
      } else {
        term.column(0);
      }
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
      lines = [];
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
