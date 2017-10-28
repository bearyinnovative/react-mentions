import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';

export default class DataSource extends PureComponent {
  static contextTypes = {
    registerDataSource: PropTypes.func.isRequired,
    updateDataSource: PropTypes.func.isRequired,
  };

  static propTypes = {
    /**
     * Called when a new mention is added in the input
     *
     * Example:
     *
     * ```js
     * function(id, display) {
     *   console.log("user " + display + " was mentioned!");
     * }
     * ```
     */
    onAdd: PropTypes.func,
    onRemove: PropTypes.func,

    renderSuggestion: PropTypes.func,

    trigger: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(RegExp)
    ]),

    isLoading: PropTypes.bool,

    type: PropTypes.string.isRequired,

    groupNames: PropTypes.object,
    groupBy: PropTypes.func,

    displayEmptySuggestion: PropTypes.func,

    shouldSuggestionsOverlayShow: PropTypes.func,
  };

  static defaultProps = {
    trigger: "@",

    onAdd: () => null,
    onRemove: () => null,
    renderSuggestion: null,
    isLoading: false,
    appendSpaceOnAdd: false,


    groupNames: {
      all: <h1 key="all">All Suggestions</h1>
    },
    groupBy: () => 'all'
  };

  componentDidMount() {
    this.context.registerDataSource(this);
  }

  componentDidUpdate() {
    this.context.updateDataSource(this);
  }

  shouldComponentUpdate(nextProps) {
    return !isEqual(nextProps, this.props);
  }

  render() {
    return null;
  }
}
