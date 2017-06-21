import React from 'react';
import PropTypes from 'prop-types';
import { defaultStyle } from 'substyle';

const styled = defaultStyle({
  fontWeight: "inherit"
});

const Mention = styled(({ display, style }) => (
  <strong {...style}>
    { display }
  </strong>
));

Mention.propTypes = {
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

  groupNames: PropTypes.object,
  groupBy: PropTypes.func
};

Mention.defaultProps = {
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

export default Mention;
