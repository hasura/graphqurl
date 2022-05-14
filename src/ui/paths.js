const _ = require('lodash');
const {GraphQLEnumType, GraphQLInputObjectType} = require('graphql');
const KIND = ':type';
const KIND_VERBOSE = ':type!';

function toPathString(inputString) {
  return inputString.replace(/(^:type!?\s+|\s+$)/g, '');
}

class TypeExpression {
  constructor(kind, type, field, inner, description, errors, path) {
    this.kind = kind;
    this.verbose = (kind == KIND_VERBOSE);
    this.type = type;
    this.field = field;
    this.inner = inner;
    this.description = description;
    this.errors = errors;
    this.path = path;
    this.topLevel = !field;
  }

  showFields() {
    if (!this.inner.fields || (this.inner.kind != 'OBJECT' && this.inner.kind != 'INTERFACE')) {
      return false;
    }

    return this.verbose || this.topLevel;
  }

  asInputString() {
    return this.kind + ' ' + this.path;
  }

  render(term) {
    term.bold(`${this.inner.kind}: ${typeName(this.type)}\n`);
    if (this.description) term.wrap(`${this.description}\n`);
    this.renderPossibleTypes(term);
    this.renderEnumValues(term);
    this.renderArguments(term);
    this.renderFields(term);
  }

  renderPossibleTypes(term) {
    if (!this.inner.possibleTypes || this.inner.possibleTypes.length === 0) {
      return;
    }

    term('members:\n');
    this.inner.possibleTypes.forEach(t => {
      term(' - ');
      term.bold(t.name);
      if (t.description) { term(` (${t.description})`); }
      term('\n');
    });
  }

  renderEnumValues(term) {
    if (this.inner.kind == 'ENUM') {
      term('values:\n');
      this.inner.enumValues.forEach(t => {
        term(' - ');
        term.bold(t.name);
        if (t.description) { term(` (${t.description})`); }
        term('\n');
      });
    }
  }

  renderArguments(term) {
    if (this.inner.kind == 'INPUT_OBJECT') {
      argumentTable(term, this.inner.inputFields.map(argumentRow));
    }
    if (this.field && !_.isEmpty(this.field.args)) {
      argumentTable(term, this.field.args.map(argumentRow));
    }
  }

  renderFields(term) {
    if (this.showFields()) {
      fieldTable(term, this.inner.fields.map(argumentRow));
    }
  }
}

function argumentRow(arg) {
  return [arg.name, typeName(arg.type), arg.description, arg.deprecationReason || 'No'];
}

function typeName(type) {
  switch (type.kind) {
    case 'NON_NULL':
      return `${typeName(type.ofType)}!`;
    case 'LIST':
      return `[${typeName(type.ofType)}]`;
    default:
      return type.name;
  }
}

function fieldTable(term, rows) {
  term('fields:\n');
  let table = [['name', 'type', 'description', 'deprecated?']];
  term.table(table.concat(rows), {
    firstRowTextAttr: {bold: true},
    width: 80,
    fit: true
  });
}

function argumentTable(term, rows) {
  term('arguments:\n');
  let table = [['name', 'type', 'description', 'deprecated?']];
  term.table(table.concat(rows), {
    firstRowTextAttr: {bold: true},
    width: 80,
    fit: true
  });
}

function typeExpression(kind, schemas, inputString) {
  let schema = schemas.indexedSchema || schemas;
  let pathString = toPathString(inputString);
  let [type, field] = typeAt(schema, pathString);
  let inner = innerType(type, schema);
  let description = field && field.description;
  if (!description && inner) description = inner.description;
  let errors = inner ? [] : [{message: 'Invalid path'}];
  return new TypeExpression(kind, type, field, inner, description, errors, pathString);
}

function innerType(type, indexedSchema) {
  let unwrapped = unwrap(type);
  if (!unwrapped) return undefined;

  return indexedSchema.index[unwrapped.name];
}

// TODO: needs work for longer paths...
function typeAt(indexedSchema, pathString) {
  let parts = pathString.split('.');

  if (parts.length == 0) {
    return undefined;
  }
  let head, tail;
  if (/^[A-Z]/.test(parts[0])) {
    head = parts[0];
    tail = parts.slice(1);
  } else {
    head = 'Query';
    tail = parts;
  }
  return tail.reduce(([t, f], name) => {
    let unwrapped = unwrap(t);
    if (!unwrapped) return [undefined, undefined];
    let full = indexedSchema.index[unwrapped.name];
    if (!full) return [undefined, undefined];
    let field = indexedSchema.index[`${full.name}.${name}`];
    if (!field) return [undefined, undefined];
    return [field.type, field];
  }, [indexedSchema.index[head], null]);
}

function unwrap(type) {
  let inner = type;
  while (inner && inner.ofType) {
    inner = inner.ofType;
  }
  return inner;
}

function suggestPath(kind, schema, indexedSchema, inputString) {
  let expr = typeExpression(kind, indexedSchema, inputString);
  let pathString = expr.path;
  let parts = pathString.split('.');
  if (parts.length < 2) {
    let types = Object.keys(schema.getTypeMap());
    let completions = types.filter(t => {
      return (!parts[0] || t.startsWith(parts[0]));
    });
    completions.prefix = `${expr.kind} `;
    return completions;
  }

  let currentPart = _.last(parts);
  let pathToType = _.initial(parts);

  let [type, _field] = typeAt(indexedSchema, pathToType.join('.'));
  if (!type) {
    return inputString;
  }
  let unwrapped = unwrap(type);

  if (unwrapped.kind === 'SCALAR') {
    return `${expr.kind} ${pathToType.join('.')}`;
  }

  let fullType = indexedSchema.index[unwrapped.name];
  if (!fullType) {
    throw new Error(`Could not find ${unwrapped.kind}: ${unwrapped.name}`);
  }
  let fields = fullType.fields || [];
  let inputFields = fullType.inputFields || [];
  let args = fullType.args || [];

  let completions = fields.concat(inputFields).concat(args).map(f => f.name);
  // console.log(`pathToType: ${pathToType.join('.')}, unwrapped: ${unwrapped.name}, completions: ${JSON.stringify(completions)}\n`);
  if (currentPart !== '') {
    if (fields[currentPart]) {
      completions = [currentPart + '.'];
    } else if (currentPart.length < 3) {
      completions = completions.filter(field => field.startsWith(currentPart));
    } else {
      completions = completions.filter(field => field.toLowerCase().includes(currentPart.toLowerCase()));
    }
  }
  if (_.isEmpty(completions)) {
    return inputString;
  }
  completions.prefix = expr.kind + ' ' + pathToType.join('.') + '.';
  return completions;
}


module.exports = {KIND, KIND_VERBOSE, typeAt, typeName, suggestPath, typeExpression};
