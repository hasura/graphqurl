const indexSchema = (rawSchema) => {
  let types = rawSchema.__schema.types;
  let index = {};
  types.forEach(t => {
    index[t.name] = t;
    if (t.fields) {
      t.fields.forEach(f => {
        index[`${t.name}.${f.name}`] = f;
      });
    }
    if (t.inputFields) {
      t.inputFields.forEach(f => {
        index[`${t.name}.${f.name}`] = f;
      });
    }
  });

  return {schema: rawSchema, index};
};

module.exports = {indexSchema};
