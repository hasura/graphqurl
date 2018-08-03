const {cli} = require('cli-ux');
const {handleGraphQLError, handleServerError} = require('./error.js');

const querySuccessCb = (ctx, response, queryType) => {
  if (queryType === 'subscription') {
    cli.action.stop('event received');
    ctx.log(JSON.stringify({data: response.data}, null, 2));
    cli.action.start('Waiting');
  } else {
    cli.action.stop('done');
    ctx.log(JSON.stringify({data: response.data}, null, 2));
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
