import React from 'react';
import { Route, IndexRoute } from 'react-router';
import { connect } from 'react-redux';
import { App, PageNotFound } from 'components';
import generatedApiExplorer from './components/ApiExplorer/ApiExplorerGenerator';

const routes = () => {
  return (
    <Route path="/" component={App}>
      <Route path="">
        <IndexRoute component={generatedApiExplorer(connect)} />
      </Route>
      <Route path="404" component={PageNotFound} status="404" />
      <Route path="*" component={PageNotFound} status="404" />
    </Route>
  );
};

export default routes;
