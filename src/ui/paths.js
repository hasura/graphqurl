const _ = require('lodash');
const {GraphQLEnumType, GraphQLInputObjectType} = require('graphql');
const KIND = ':type';

function toPathString(inputString) {
  return inputString.replace(/(^:type\s+|\s+$)/g, '');
}

class TypeExpression {
  constructor(type, field, inner, description, errors, path) {
    this.kind = KIND;
    this.type = type;
    this.field = field;
    this.inner = inner;
    this.description = description;
    this.errors = errors;
    this.path = path;
  }

  asInputString() {
    return KIND + ' ' + this.path;
  }

  render(term) {
    term.bold(typeName(this.type) + '\n');
    if (this.description) term.wrap(`${this.description}\n`);
    if (this.inner.kind == 'ENUM') {
      term('values:\n');
      this.inner.enumValues.forEach(t => {
        term(' - ');
        term.bold(t.name);
        if (t.description) { term(` (${t.description})`); }
        term('\n');
      });
    }
    if (this.inner.kind == 'INPUT_OBJECT') {
      argumentTable(term, this.inner.inputFields.map(arg => {
        return [arg.name, typeName(arg.type), arg.description, arg.deprecationReason || 'No'];
      }));
    }
    if (this.field && !_.isEmpty(this.field.args)) {
      argumentTable(term, this.field.args.map(arg => {
        return [arg.name, typeName(arg.type), arg.description, arg.deprecationReason || 'No'];
      }));
    }
  }
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

function argumentTable(term, rows) {
  term('arguments:\n');
  let table = [['name', 'type', 'description', 'deprecated?']];
  term.table(table.concat(rows), {
    firstRowTextAttr: {bold: true},
    width: 80,
    fit: true
  });
}

function typeExpression(schemas, inputString) {
  let pathString = toPathString(inputString);
  let [type, field] = typeAt(schemas.indexedSchema, pathString);
  let inner = innerType(type, schemas.indexedSchema);
  let description = field && field.description;
  if (!description && inner) description = inner.description;
  let errors = inner ? [] : [{message: 'Invalid path'}];
  return new TypeExpression(type, field, inner, description, errors, pathString);
}

function innerType(type, indexedSchema) {
  let unwrapped = unwrap(type);
  if (!unwrapped) return undefined;

  return indexedSchema.index[unwrapped.name];
}

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

function suggestPath(schema, indexedSchema, inputString) {
  let pathString = toPathString(inputString);
  let parts = pathString.split('.');
  if (parts.length < 2) {
    let types = Object.keys(schema.getTypeMap());
    let completions = types.filter(t => {
      return (!parts[0] || t.startsWith(parts[0]));
    });
    completions.prefix = `${KIND} `;
    return completions;
  }

  let currentPartEmpty = pathString == '' || pathString.endsWith('.');
  let pathToType = currentPartEmpty ? parts : _.initial(parts);

  let [type, _field] = typeAt(indexedSchema, pathToType.join('.'));
  if (!type) {
    return inputString;
  }
  let unwrapped = unwrap(type);
  let fields = unwrapped.fields || [];
  let inputFields = unwrapped.inputFields || [];
  let args = unwrapped.args || [];

  let completions = fields.concat(inputFields).concat(args).map(f => f.name);
  if (!currentPartEmpty) {
    let currentPart = _.last(parts);
    if (fields[currentPart]) {
      completions = [currentPart + '.'];
    } else {
      completions = completions.filter(field => field.startsWith(currentPart));
    }
  }
  if (_.isEmpty(completions)) {
    return inputString;
  }
  completions.prefix = KIND + ' ' + pathToType.join('.') + '.';
  return completions;
}


module.exports = {KIND, typeAt, typeName, suggestPath, typeExpression};
