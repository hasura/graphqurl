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
    term.bold(this.type + '\n');
    if (this.description) term.wrap(`${this.description}\n`);
    if (this.inner instanceof GraphQLEnumType) {
      term('values:\n');
      this.inner.getValues().forEach(t => {
        term(' - ');
        term.bold(t.name);
        if (t.description) { term(` (${t.description})`); }
        term('\n');
      });
    }
    if (this.inner instanceof GraphQLInputObjectType) {
      let args = this.inner.getFields();
      argumentTable(term, Object.values(args).map(arg => {
        return [arg.name, arg.type, arg.description];
      }));
    }
    if (this.field && !_.isEmpty(this.field.args)) {
      argumentTable(term, this.field.args.map(arg => {
        return [arg.name, arg.type, arg.description];
      }));
    }
  }
}

function argumentTable(term, rows) {
  term('arguments:\n');
  let table = [['name', 'type', 'description']];
  term.table(table.concat(rows), {
    firstRowTextAttr: {bold: true},
    width: 72,
    fit: true
  });
}

function typeExpression(schema, inputString) {
  let pathString = toPathString(inputString);
  let [type, field] = typeAt(schema, pathString);
  let inner = unwrap(type);
  let description = type && type.description;
  if (!description && inner) description = inner.description;
  let errors = type ? [] : ['Invalid path'];
  return new TypeExpression(type, field, inner, description, errors, pathString);
}

function typeAt(schema, pathString) {
  let types = schema.getTypeMap();
  let parts = pathString.split('.');

  if (parts.length == 0) {
    return undefined;
  }
  let root = types[parts[0]];
  return parts.slice(1).reduce(([t, f], name) => {
    if (!t) return [undefined, f];
    let field = unwrap(t).getFields()[name];
    return [field && field.type, field];
  }, [root, null]);
}

function unwrap(type) {
  let inner = type;
  while (inner && inner.ofType) {
    inner = inner.ofType;
  }
  return inner;
}

function suggestPath(schema, inputString) {
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

  let [type, _field] = typeAt(schema, pathToType.join('.'));
  if (!type) {
    return inputString;
  }
  let fields = unwrap(type).getFields();

  let completions = Object.keys(fields);
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


module.exports = {KIND, suggestPath, typeExpression};
