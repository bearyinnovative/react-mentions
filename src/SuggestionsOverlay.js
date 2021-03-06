import React, { Component, cloneElement } from 'react';
import PropTypes from 'prop-types';
import { defaultStyle } from 'substyle';

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
    onClose: PropTypes.func,
  };

  static defaultProps = {
    suggestions: {},
    onSelect: () => null,
  };

  componentDidUpdate() {
    const { suggestions } = this.refs;
    if (!suggestions || suggestions.offsetHeight >= suggestions.scrollHeight || !this.props.scrollFocusedIntoView) {
      return;
    }

    const scrollTop = suggestions.scrollTop;
    let { top, bottom } = suggestions.children[this.props.focusIndex].getBoundingClientRect();
    const { top: topContainer } = suggestions.getBoundingClientRect();
    top = top - topContainer + scrollTop;
    bottom = bottom - topContainer + scrollTop;

    if (top < scrollTop) {
      suggestions.scrollTop = top;
    } else if (bottom > suggestions.offsetHeight) {
      suggestions.scrollTop = bottom - suggestions.offsetHeight;
    }
  }

  componentWillUnmount() {
    this.props.onClose && this.props.onClose();
  }

  render() {
    const { suggestions, isLoading, style, onMouseDown } = this.props;

    const hasHit = utils.hasHitMention(suggestions);

    if (!hasHit) {
      return null;
    }

    const hasSuggestions = utils.countSuggestions(suggestions);

    return (
      <div
        {...style}
        onMouseDown={onMouseDown}
      >
        <ul
          ref="suggestions"
          { ...style('list') }
        >
          { hasSuggestions ? this.renderSuggestions() : this.renderEmptySuggestion() }
        </ul>
        { this.renderLoadingIndicator() }
      </div>
    );
  }

  collectSuggestionElements(source, suggestions, index, descriptor, prevGroup) {
    const current = suggestions[index];

    if (!current) {
      return [];
    }

    const { mentionDescriptor: { props: { groupBy, groupNames } } } = descriptor;
    const collectedGroup = groupBy(current);

    const isGroupCollected = collectedGroup === prevGroup;
    const nameElement = !isGroupCollected ?
      <li className={this.props.style('title').className}
          key={collectedGroup}>
        {groupNames[collectedGroup]}
      </li> : null;

    return [
      nameElement,
      this.renderSuggestion(
        current,
        descriptor,
        source.length + index,
      ),
      ...this.collectSuggestionElements(source, suggestions, index + 1, descriptor, collectedGroup)
    ];
  }

  renderSuggestions() {
    return reduce(
      utils.getSuggestions(this.props.suggestions),
      (source, { suggestions, descriptor }) => [
        ...source,
        ...this.collectSuggestionElements(source, suggestions, 0, descriptor)
      ],
      [],
    );
  }

  renderEmptySuggestion() {
    return reduce(
      utils.getSuggestions(this.props.suggestions),
      (source, { descriptor: { mentionDescriptor } }, i) => [
        ...source,
        (mentionDescriptor.props.displayEmptySuggestion &&
          <Suggestion
            key={i}
            style={this.props.style('item')}
            placeholder={mentionDescriptor.props.displayEmptySuggestion(mentionDescriptor)}/>)
      ],
      [],
    );
  }

  renderSuggestion(suggestion, descriptor, index) {
    let id = this.getID(suggestion);
    let isFocused = (index === this.props.focusIndex);

    let { mentionDescriptor, query } = descriptor;

    return (
      <Suggestion
        style={this.props.style('item')}
        key={ id }
        id={ id }
        ref={isFocused ? 'focused' : null}
        query={ query }
        index={ index }
        descriptor={ mentionDescriptor }
        suggestion={ suggestion }
        focused={ isFocused }
        onClick={ () => this.select(suggestion, descriptor) }
        onMouseEnter={ () => this.handleMouseEnter(index) }/>
    );
  }

  getID(suggestion) {
    if (suggestion instanceof String) {
      return suggestion;
    }

    return suggestion.id;
  }

  renderLoadingIndicator() {
    if (!this.props.isLoading) {
      return;
    }

    return <LoadingIndicator { ...this.props.style('loadingIndicator') } />;
  }

  handleMouseEnter(index, ev) {
    if (this.props.onMouseEnter) {
      this.props.onMouseEnter(index);
    }
  }

  select(suggestion, descriptor) {
    this.props.onSelect(suggestion, descriptor);
  }

}

const styled = defaultStyle(({ position }) => ({
  position: 'absolute',
  zIndex: 1,
  marginTop: 14,
  minWidth: 100,
  ...position,

  list: {
    margin: 0,
    padding: 0,
    listStyleType: 'none',
  },

  title: {},
}));

export default styled(SuggestionsOverlay);
