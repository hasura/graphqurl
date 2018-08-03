const query = require('./query.js');

class Client {
  constructor(args) {
    this.endpoint = args.endpoint;
    this.headers = args.headers;
  }

  query(queryString, variables, name) {
    return new Promise((resolve, reject) => {
      query({
        query: queryString,
        endpoint: this.endpoint,
        headers: this.headers,
        variables,
        name,
      }).then(response => resolve(response))
      .catch(error => reject(error));
    });
  }
}

module.exports = Client;
