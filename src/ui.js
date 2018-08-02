const tk = require('terminal-kit');
const {introspectionQuery, buildClientSchema, parse} = require('graphql');
const query = require('./query');
const {validateQuery, getAutocompleteSuggestions} = require('graphql-language-service-interface');
const {Position} = require('graphql-language-service-utils');

// FIXME: needs js idiomatic refactor eslint-disable-line no-warning-comments

var term = tk.terminal;

let qs = '';
let p = new Position(0, 0);
let ib;
let qReady = false;
let schema;
let menuOn = false;
let gResolve, gReject;

const terminate = error => {
  term.nextLine(1);
  term.grabInput(false);
  term.fullscreen(false);
  if (error) {
    gReject(error);
    return;
  }
  gResolve(qs);
};

// const ibOpts = {}
const ibCb = error => {
  if (error) {
    terminate(error);
  }
};

const inputLine = d => {
  term('gql> ');
  ib = term.inputField({
    default: d ? d : '',
  }, ibCb);
  qReady = true;
};

const mOpts = {
  style: term.inverse,
  selectedStyle: term.dim.blue.bgGreen,
  exitOnUnexpectedKey: true,
};
let mItems = ['hello', 'world'];

term.on('key', async function (key) {
  if (key === 'CTRL_C') {
    terminate('cancelled');
  }

  if (qReady) {
    if (key === 'CTRL_Q') {
      qs = ib.getInput();
      ib.abort();
      terminate();
    }

    if ((key === 'ENTER' || key === 'KP_ENTER') && !menuOn) {
      qs = ib.getInput();
      try {
        const errors = await validateQuery(parse(qs), schema);
        if (errors.length === 0) {
          ib.abort();
          terminate();
        }
      } catch (err) {
        ib.abort();
        term.eraseLine();
        term.left(qs.length + 5);
        inputLine(qs);
      }
    }

    if (key === 'TAB' && !menuOn) {
      qs = ib.getInput();
      p.setCharacter(qs.length - 1);
      let acs = getAutocompleteSuggestions(schema, qs, p);
      acs = acs.map(o => o.label);
      mItems = acs;
      menuOn = true;
      let resp = qs;
      try {
        let r = await term.singleLineMenu(mItems, mOpts).promise;

        // TODO: need better logic here
        let sp = qs.split(' ');
        let rm = sp.pop();
        resp = sp.join(' ') + (sp.length > 0 ? ' ' : '') + (r.selectedText ? r.selectedText : rm);

        ib.abort();
        term.eraseLine();
        term.previousLine();
        term.eraseLine();
        inputLine(resp);
      } catch (e) {
      }
      menuOn = false;
    }
  }
});

const getQueryFromTerminalUI = (endpoint, headers)  => {
  return new Promise((resolve, reject) => {
    gResolve = resolve;
    gReject = reject;
    query({endpoint: endpoint, query: introspectionQuery, headers: headers}, response => {
      const r = response.data;
      // term.fullscreen(true);
      schema = buildClientSchema(r);
      console.log('Enter the query, use TAB to auto-complete, Ctrl+Q to execute, Ctrl+C to cancel');
      inputLine();
    }, error => {
      terminate(error);
    });
  });
};

module.exports = getQueryFromTerminalUI;
