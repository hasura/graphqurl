const tk = require( 'terminal-kit' );
const { introspectionQuery, buildClientSchema } = require('graphql');
const Query = require('./query');
const { getAutocompleteSuggestions } = require('graphql-language-service-interface');
const { Position } = require('graphql-language-service-utils');

const endpoint = "https://fierce-temple-26829.herokuapp.com/v1alpha1/graphql";

var term = tk.terminal;

let qs = '';
let p = new Position(0, 0);
let ib;
let qReady = false;
let schema;
let menuOn = false;

Query({endpoint: endpoint, query: introspectionQuery}, (response) => {
  const r = response.data;
  // term.fullscreen(true);
  schema = buildClientSchema(r);
  inputLine();
}, (error) => {
  console.log(error);
  terminate();
});

const ibOpts = {};
const ibCb = (error, input) => {
  if (error) {
    console.log('error happened');
    console.log(error);
    terminate();
  } else {
    // console.log('\n\ngot input: ' +input);
  }
};

const inputLine = (d) => {
  term.saveCursor();
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
		term.green( 'CTRL-C detected...\n' ) ;
		terminate() ;
	}

  if (qReady) {
    if (key == 'CTRL_Q') {
      qs = ib.getInput();
      ib.abort();
      console.log('got input: ', qs);
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



function terminate()
{
	term.grabInput( false ) ;
  // term.fullscreen(false);
	// Add a 100ms delay, so the terminal will be ready when the process effectively exit, preventing bad escape sequences drop
	setTimeout( function() { process.exit() ; } , 500 ) ;
}
