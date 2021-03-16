const {cli} = require('cli-ux');
const {handleGraphQLError, handleServerError} = require('./error.js');
const {buildClientSchema, printSchema} = require('graphql');

const querySuccessCb = (ctx, response, queryType) => {
  let out = ctx.flags.singleLine ? JSON.stringify({data: response.data}) : JSON.stringify({data: response.data}, null, 2);
  if (queryType === 'subscription') {
    cli.action.stop('event received');
    ctx.log(out);
    ctx.action.start('Waiting');
  } else {
    if (ctx.flags.introspect) {
      if (ctx.flags.format === 'graphql') {
        const schema = buildClientSchema(response.data);
        out = printSchema(schema);
      } else {
        out = ctx.flags.singleLine ? JSON.stringify(response.data) : JSON.stringify(response.data, null, 2);
      }
    }
    cli.action.stop('done');
    ctx.log(out);
  }
};

const queryErrorCb = (ctx, queryError, queryType) => {
  cli.action.stop('error');

  if (!queryType) {
    handleGraphQLError(queryError);
  } else if (queryType === 'subscription') {
    if (queryError.originalError) {
      const {code, path, error} = queryError.originalError;
      handleServerError(`[${code}] at [${path}]: ${error}`);
    }
  } else {
    handleServerError(queryError);
  }
};

module.exports = {
  querySuccessCb,
  queryErrorCb,
};
