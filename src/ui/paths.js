const _ = require('lodash');
const {GraphQLEnumType, GraphQLInputObjectType} = require('graphql');
const KIND = ':type';

function toPathString(inputString) {
  return inputString.replace(/(^:type\s+|\s+$)/g, '');
}

class TypeExpression {
  constructor(type, inner, description, errors, path) {
    this.kind = KIND;
    this.type = type;
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
      term('arguments:\n');
      let table = [['name', 'type', 'description']];
      let args = this.inner.getFields();
      for (let name in args) {
        let t = args[name];
        table.push([t.name, t.type, t.description]);
      }
      term.table(table, {firstRowTextAttr: {bold: true}, width: 72, fit: true});
    }
  }
}

function typeExpression(schema, inputString) {
  let pathString = toPathString(inputString);
  let type = typeAt(schema, pathString);
  let inner = unwrap(type);
  let description = type && type.description;
  if (!description && inner) description = inner.description;
  let errors = type ? [] : ['Invalid path'];
  return new TypeExpression(type, inner, description, errors, pathString);
}

function typeAt(schema, pathString) {
  let types = schema.getTypeMap();
  let parts = pathString.split('.');

  if (parts.length == 0) {
    return undefined;
  }
  let root = types[parts[0]];
  return parts.slice(1).reduce((t, name) => {
    if (!t) return undefined;
    let field = unwrap(t).getFields()[name];
    return field && field.type;
  }, root);
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

  let type = typeAt(schema, pathToType.join('.'));
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
