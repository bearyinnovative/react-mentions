import React, { Component, cloneElement } from 'react';
import PropTypes from 'prop-types';
import { defaultStyle } from 'substyle';

import map from 'lodash/map';
import flatMap from 'lodash/flatMap';
import groupBy from 'lodash/groupBy';
import reduce from 'lodash/reduce';

import utils from './utils';

import Suggestion from './Suggestion';
import LoadingIndicator from './LoadingIndicator';

class SuggestionsOverlay extends Component {

  static propTypes = {
    suggestions: PropTypes.object.isRequired,
    focusIndex: PropTypes.number,
    scrollFocusedIntoView: PropTypes.bool,
    isLoading: PropTypes.bool,
    onSelect: PropTypes.func,
  };

  static defaultProps = {
    suggestions: {},
    onSelect: () => null
  };

  componentDidUpdate() {
    const { suggestions } = this.refs
    if (!suggestions || suggestions.offsetHeight >= suggestions.scrollHeight || !this.props.scrollFocusedIntoView) {
      return
    }

    const scrollTop = suggestions.scrollTop
    let { top, bottom } = suggestions.children[this.props.focusIndex].getBoundingClientRect();
    const { top: topContainer } = suggestions.getBoundingClientRect();
    top = top - topContainer + scrollTop;
    bottom = bottom - topContainer + scrollTop;

    if(top < scrollTop) {
      suggestions.scrollTop = top
    } else if(bottom > suggestions.offsetHeight) {
      suggestions.scrollTop = bottom - suggestions.offsetHeight
    }
  }

  render() {
    const { suggestions, isLoading, style, onMouseDown } = this.props;

    // do not show suggestions until there is some data
    if(utils.countSuggestions(suggestions) === 0 && !isLoading) {
      return null;
    }

    return (
      <div
        {...style}
        onMouseDown={onMouseDown}
      >
        <ul
          ref="suggestions"
          { ...style("list") }
        >
          { this.renderSuggestions() }
        </ul>
        { this.renderLoadingIndicator() }
      </div>
    );
  }

  renderSuggestions() {
    return reduce(utils.getSuggestions(this.props.suggestions), (result, { suggestions, descriptor }) => {
      const { mentionDescriptor } = descriptor;

      let index = 0;
      const groups = groupBy(suggestions, mentionDescriptor.props.groupBy);
      const groupedSuggestions = flatMap(mentionDescriptor.props.groupNames, (element, name) =>
        groups[name] ? [
          <span className={this.props.style("title").className} key={name}>{element}</span>,
          ...map(groups[name], (suggestion) => this.renderSuggestion(
            suggestion,
            descriptor,
            result.length + (index++)
          ))
        ] : []
      );

      return [...result, ...groupedSuggestions];
    }, []);
  }

  renderSuggestion(suggestion, descriptor, index) {
    let id = this.getID(suggestion);
    let isFocused = (index === this.props.focusIndex);

    let { mentionDescriptor, query } = descriptor;

    return (
      <Suggestion
        style={this.props.style("item")}
        key={ id }
        id={ id }
        ref={isFocused ? "focused" : null}
        query={ query }
        index={ index }
        descriptor={ mentionDescriptor }
        suggestion={ suggestion }
        focused={ isFocused }
        onClick={ () => this.select(suggestion, descriptor) }
        onMouseEnter={ () => this.handleMouseEnter(index) } />
    );
  }

  getID(suggestion) {
    if(suggestion instanceof String) {
      return suggestion;
    }

    return suggestion.id;
  }

  renderLoadingIndicator () {
    if(!this.props.isLoading) {
      return;
    }

    return <LoadingIndicator { ...this.props.style("loadingIndicator") } />
  }

  handleMouseEnter(index, ev) {
    if(this.props.onMouseEnter) {
      this.props.onMouseEnter(index);
    }
  }

  select(suggestion, descriptor) {
    this.props.onSelect(suggestion, descriptor);
  }

}

const styled = defaultStyle(({ position }) => ({
  position: "absolute",
  zIndex: 1,
  marginTop: 14,
  minWidth: 100,
  ...position,

  list: {
    margin: 0,
    padding: 0,
    listStyleType: "none",
  },

  title: {}
}));

export default styled(SuggestionsOverlay);
