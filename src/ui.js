const tk = require( 'terminal-kit' );
const { introspectionQuery, buildClientSchema } = require('graphql');
const query = require('./query');
const { getAutocompleteSuggestions } = require('graphql-language-service-interface');
const { Position } = require('graphql-language-service-utils');

// FIXME: needs js idiomatic refactor

var term = tk.terminal;

let qs = '';
let p = new Position(0, 0);
let ib;
let qReady = false;
let schema;
let menuOn = false;
let gResolve, gReject;

const ibOpts = {};
const ibCb = (error, input) => {
  if (error) {
    terminate(error);
  }
};

const inputLine = (d) => {
  term('gql> ');
  ib = term.inputField({
    default: d ? d : ''
  }, ibCb);
  qReady = true;
};

const mOpts = {
  style: term.inverse ,
  selectedStyle: term.dim.blue.bgGreen
};
let mItems = ['hello', 'world'];

term.on( 'key' , async function( key ) {
  if ( key === 'CTRL_C' )
  {
    terminate('cancelled');
  }

  if (qReady) {
    if (key == 'CTRL_Q') {
      qs = ib.getInput();
      ib.abort();
      terminate();
    }

    if (key === 'TAB' && !menuOn) {
      qs = ib.getInput();
      p.setCharacter(qs.length - 1);
      let acs = getAutocompleteSuggestions(schema, qs, p);
      acs = acs.map((o) => o.label);
      mItems = acs;
      menuOn = true;
      let resp = qs;
      try {
        r = await term.singleLineMenu( mItems, mOpts ).promise;
        sp = qs.split(' ');
        sp.pop();
        resp = sp.join(' ') + ' ' + r.selectedText;
        ib.abort();
        term.previousLine();
        term.eraseLine();
        inputLine(resp);
      } catch (e) {
      }
      menuOn = false;
    }
  }
} ) ;

const terminate = (error) => {
  term.nextLine(1);
  term.grabInput(false) ;
  term.fullscreen(false);
  if (error) {
    gReject(error);
    return;
  }
  gResolve(qs);
};

const getQueryFromTerminalUI = (endpoint, headers)  => {
  return new Promise((resolve, reject) => {
    gResolve = resolve;
    gReject = reject;
    query({endpoint: endpoint, query: introspectionQuery, headers: headers}, (response) => {
      const r = response.data;
      // term.fullscreen(true);
      schema = buildClientSchema(r);
      console.log('Enter the query, use TAB to auto-complete, Ctrl+Q to execute, Ctrl+C to cancel');
      inputLine();
    }, (error) => {
      terminate(error);
    });
  });
};

module.exports = getQueryFromTerminalUI;
