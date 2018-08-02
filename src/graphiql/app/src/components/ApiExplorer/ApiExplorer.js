/* eslint-disable */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ApiRequestWrapper from './ApiRequestWrapper';
import Helmet from 'react-helmet';

import {
  changeTabSelection,
  changeApiSelection,
  expandAuthApi,
  clearHistory,
  changeRequestParams,
} from './Actions';

class ApiExplorer extends Component {

  render() {
    const styles = require('./ApiExplorer.scss');
    let wrapperClass = styles.apiExplorerWrapper;
    let panelStyles = '';
    let requestStyles = '';
    let wdClass = '';
    let requestWrapper = (
      <ApiRequestWrapper
        credentials={this.props.credentials}
        explorerData={this.props.explorerData}
        details={this.props.displayedApi.details}
        request={this.props.displayedApi.request}
        requestStyles={requestStyles}
        dispatch={this.props.dispatch}
        wdStyles={wdClass}
        route={this.props.route}
        dataHeaders={this.props.dataHeaders}
        headerFocus={this.props.headerFocus}
      />
    );

    return (
      <div className={'container-fluid ' + styles.padd_remove}>
        <Helmet title="API Explorer | Hasura" />
        <div className={wrapperClass}>{requestWrapper}</div>
      </div>
    );
  }
}

ApiExplorer.propTypes = {
  modalState: PropTypes.object.isRequired,
  dispatch: PropTypes.func.isRequired,
  route: PropTypes.object.isRequired,
  headerFocus: PropTypes.bool.isRequired,
};

export default ApiExplorer;
