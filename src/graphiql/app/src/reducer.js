import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';
import apiExplorerReducer from 'components/ApiExplorer/Actions';
import progressBarReducer from 'components/App/Actions';

import { reducer as notifications } from 'react-notification-system-redux';

const reducer = combineReducers({
  progressBar: progressBarReducer,
  apiexplorer: apiExplorerReducer,
  routing: routerReducer,
  notifications,
});

export default reducer;
