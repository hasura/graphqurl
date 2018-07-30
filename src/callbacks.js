const {cli} = require('cli-ux');
const { handleGraphQLError, handleServerError } = require('./error.js');

const querySuccessCb = (ctx, response, queryType, parsedQuery, endpoint) => {
  if (queryType === 'subscription') {
    cli.action.stop('event received');
    ctx.log(JSON.stringify(response.data, null, 2));
    cli.action.start('Waiting');
  } else {
    cli.action.stop('done');
    ctx.log(JSON.stringify(response.data, null, 2));
  }
  return;
};

const queryErrorCb = (ctx, queryError, queryType, parsedQuery, endpoint) => {
  if (!queryType) {
    handleGraphQLError(queryError);
  } else if (queryType == 'subscription') {
    if (queryError.originalError) {
      const { code, path, error } = queryError.originalError;
      handleServerError(`[${code}] at [${path}]: ${error}`);
    }
  } else {
    handleServerError(queryError);
  }
  return;
};

module.exports = {
  querySuccessCb,
  queryErrorCb
};
