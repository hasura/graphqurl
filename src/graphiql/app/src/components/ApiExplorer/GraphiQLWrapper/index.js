import React, { Component } from 'react';
import GraphiQL from 'graphiql';
import PropTypes from 'prop-types';
import { parse as sdlParse, print } from 'graphql';
import snippets from 'graphiql-code-exporter/lib/snippets';
import GraphiQLErrorBoundary from './GraphiQLErrorBoundary';
import OneGraphExplorer from '../OneGraphExplorer/OneGraphExplorer';
import CodeExporter from 'graphiql-code-exporter';
import { copyToClipboard } from './utils'

import { clearCodeMirrorHints, setQueryVariableSectionHeight } from './utils';
import { graphQLFetcherFinal } from '../Actions';

import './GraphiQL.css';

class GraphiQLWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: false,
      noSchema: false,
      copyButtonText: 'Copy',
      codeExporterOpen: false,
    };
  }

  componentDidMount() {
    setQueryVariableSectionHeight();
  }

  componentWillUnmount() {
    clearCodeMirrorHints();
  }

  _handleToggleCodeExporter = () => {
    const nextState = !this.state.codeExporterOpen;
    this.setState({ codeExporterOpen: nextState });
  };

  render() {
    const styles = require('../../Common/Common.scss');

    const { urlParams, headerFocus } = this.props;
    const graphqlNetworkData = this.props.data;

    const graphQLFetcher = graphQLParams => {
      if (headerFocus) {
        return null;
      }

      return graphQLFetcherFinal(
        graphQLParams,
        graphqlNetworkData.url,
        graphqlNetworkData.headers
      );
    };

    let graphiqlContext;

    const handleClickPrettifyButton = () => {
      const editor = graphiqlContext.getQueryEditor();
      const currentText = editor.getValue();
      const prettyText = print(sdlParse(currentText));
      editor.setValue(prettyText);
    };

    const handleCopyQuery = () => {
      const editor = graphiqlContext.getQueryEditor();
      console.log('got editor');
      const query = editor.getValue();
      console.log('got query')
      if (!query) {
        return;
      }
      copyToClipboard(query);
      this.setState({ copyButtonText: 'Copied' });
      setTimeout(() => {
        this.setState({ copyButtonText: 'Copy' });
      }, 1500);
    };

    const handleToggleHistory = () => {
      graphiqlContext.setState(prevState => ({
        historyPaneOpen: !prevState.historyPaneOpen,
      }));
    };

    const renderGraphiql = graphiqlProps => {
      const newGraphiQLProps = { ...graphiqlProps };
      const { variables, query } = window.__env;
      if (query || Object.keys(variables).length !== 0) {
        newGraphiQLProps.query = query;
        newGraphiQLProps.variables = JSON.stringify(variables, null, 2);
      }

            // get toolbar buttons
      const getGraphiqlButtons = () => {
        const buttons = [
          {
            label: 'Prettify',
            title: 'Prettify Query (Shift-Ctrl-P)',
            onClick: handleClickPrettifyButton,
          },
          {
            label: 'History',
            title: 'Show History',
            onClick: handleToggleHistory,
          },
          {
            label: this.state.copyButtonText,
            title: 'Copy Query',
            onClick: handleCopyQuery,
          },
          {
            label: 'Explorer',
            title: 'Toggle Explorer',
            onClick: graphiqlProps.toggleExplorer,
          },
          {
            label: 'Code Exporter',
            title: 'Toggle Code Exporter',
            onClick: this._handleToggleCodeExporter,
          },
        ];
        return buttons.map(b => {
          return <GraphiQL.Button key={b.label} {...b} />;
        });
      };

      return (
        <>
          <GraphiQL
            {...graphiqlProps}
            ref={c => {
              graphiqlContext = c;
            }}
            fetcher={graphQLFetcher}
          >
            <GraphiQL.Logo>GraphiQL</GraphiQL.Logo>
            <GraphiQL.Toolbar>
              {getGraphiqlButtons()}
            </GraphiQL.Toolbar>
          </GraphiQL>
          {this.state.codeExporterOpen ? (
            <CodeExporter
              hideCodeExporter={this._handleToggleCodeExporter}
              snippets={snippets}
              query={graphiqlProps.query}
              codeMirrorTheme="default"
            />
          ) : null}
        </>
      );
    };

    return (
      <GraphiQLErrorBoundary>
        <div
          className={
            'react-container-graphql ' +
            styles.wd100 +
            ' ' +
            styles.graphQLHeight
          }
        >
          <OneGraphExplorer
            renderGraphiql={renderGraphiql}
            endpoint={graphqlNetworkData.url}
            headers={graphqlNetworkData.headers}
            headerFocus={headerFocus}
            urlParams={urlParams}
          />
        </div>
      </GraphiQLErrorBoundary>
    );
  }
}

GraphiQLWrapper.propTypes = {
  dispatch: PropTypes.func.isRequired,
  data: PropTypes.object.isRequired,
  headerFocus: PropTypes.bool.isRequired,
  urlParams: PropTypes.object.isRequired,
};

export default GraphiQLWrapper;
