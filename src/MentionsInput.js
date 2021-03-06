import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

import keys from 'lodash/keys';
import values from 'lodash/values';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import flatten from 'lodash/flatten';
import groupBy from 'lodash/groupBy';

import { defaultStyle } from 'substyle';

import utils from './utils';
import SuggestionsOverlay from './SuggestionsOverlay';
import Highlighter from './Highlighter';

export const _getTriggerRegex = function(trigger, options={}) {
  if (trigger instanceof RegExp) {
    return trigger
  } else {
    const { allowSpaceInQuery } = options
    const escapedTriggerChar = utils.escapeRegex(trigger)

    // first capture group is the part to be replaced on completion
    // second capture group is for extracting the search query
    return new RegExp(`(?:^|\\s)(${escapedTriggerChar}([^${allowSpaceInQuery ? '' : '\\s'}${escapedTriggerChar}]*))$`)
  }
}

const _getDataProvider = function(data) {
  if(data instanceof Array) {
    // if data is an array, create a function to query that
    return function(query, callback) {
      const results = [];
      for(let i=0, l=data.length; i < l; ++i) {
        const display = data[i].display || data[i].id;
        if(display.toLowerCase().indexOf(query.toLowerCase()) >= 0) {
          results.push(data[i]);
        }
      }
      return results;
    };
  } else {
    // expect data to be a query function
    return data;
  }
};

const KEY = { TAB : 9, RETURN : 13, ESC : 27, UP : 38, DOWN : 40, SPACE: 32 };

let isComposing = false;

class MentionsInput extends React.Component {
  static propTypes = {
    /**
     * If set to `true` a regular text input element will be rendered
     * instead of a textarea
     */
    singleLine: PropTypes.bool,

    /**
     * If set to `true` spaces will not interrupt matching suggestions
     */
    allowSpaceInQuery: PropTypes.bool,

    markup: PropTypes.string,
    value: PropTypes.string,

    displayTransform: PropTypes.func,
    onKeyDown: PropTypes.func,
    onSelect: PropTypes.func,
    onBlur: PropTypes.func,
    onChange: PropTypes.func,

    children: PropTypes.oneOfType([
      PropTypes.element,
      PropTypes.arrayOf(PropTypes.element),
    ]).isRequired,
    appendedTextElements: PropTypes.oneOfType([
      PropTypes.node,
      PropTypes.arrayOf(PropTypes.node),
    ]),

    compileMarkup: PropTypes.func,

    onCaretPositionChange: PropTypes.func,

    autofocus: PropTypes.bool,

    dataSources: PropTypes.arrayOf(PropTypes.node),

    selectionStart: PropTypes.number,
    selectionEnd: PropTypes.number,
    resetSelection: PropTypes.bool,
  };

  static defaultProps = {
    markup: "@[__display__](__id__)",
    singleLine: false,
    displayTransform: function(id, display, type) {
      return display;
    },
    onKeyDown: () => null,
    onSelect: () => null,
    onBlur: () => null,
    compileMarkup: (markup) => markup
  };

  constructor(props) {
    super(props);
    this.suggestions = {};

    this.state = {
      focusIndex: 0,

      selectionStart: null,
      selectionEnd: null,

      suggestions: {},

      caretPosition: null,
      suggestionsPosition: null,

      dataSources: [],
    };
  }

  static childContextTypes = {
    registerDataSource: PropTypes.func,
    updateDataSource: PropTypes.func,
  };

  getChildContext = () => ({
    registerDataSource: (dataSource) => {
      this.setState(prevState => ({ ...prevState, dataSources: prevState.dataSources.concat([dataSource])}))
    },
    updateDataSource: (dataSource) => {
      this.setState(prevState => {
        const newDataSources = prevState.dataSources.filter(ds => ds.props.type !== dataSource.props.type);
        return { ...prevState, dataSources: newDataSources.concat([dataSource]) };
      });
    }
  });

  resetFocusIndex = () => this.setState({ focusIndex: 0, suggestionsClassNameModifier: '' });

  focus = () => this.refs.input.focus();
  blur = () => this.refs.input.blur();

  render() {
    return (
      <div ref="container" {...this.props.style}>
        { this.props.dataSources }
        { this.renderControl() }
        { this.renderSuggestionsOverlay() }
      </div>
    );
  }

  getInputProps = (isTextarea) => {
    let { readOnly, disabled, style, autoFocus, onFocus } = this.props;

    // pass all props that we don't use through to the input control
    let props = omit(this.props, 'style', keys(MentionsInput.propTypes));

    return {
      ...props,
      ...style("input"),

      autoFocus: autoFocus,
      value: this.getPlainText(),

      ...(!readOnly && !disabled && {
        onFocus: onFocus,
        onChange: this.handleChange,
        onSelect: this.handleSelect,
        onBlur: this.handleBlur,
      })
    };
  };

  renderControl = () => {
    let { singleLine, style } = this.props;
    let inputProps = this.getInputProps(!singleLine);

    return (
      <div { ...style("control") }>
        { this.renderHighlighter(inputProps.style) }
        { singleLine ? this.renderInput(inputProps) : this.renderTextarea(inputProps) }
      </div>
    );
  };

  renderInput = (props) => {
    return (
      <input
        type="text"
        ref="input"
        { ...props } />
    );
  };

  renderTextarea = (props) => {
    return (
      <textarea
        ref="input"
        { ...props } />
    );
  };

  renderSuggestionsOverlay = () => {
    if (!utils.shouldSuggestionsOverlayShow(this.state.suggestions)) {
      return null;
    }

    if(!utils.isNumber(this.state.selectionStart)) {
      // do not show suggestions when the input does not have the focus
      return null;
    }

    const style = this.props.style({
      'suggestions': true,
      [this.state.suggestionsClassNameModifier]: true
    });

    return (
      <SuggestionsOverlay
        style={ style }
        position={ this.state.suggestionsPosition }
        focusIndex={ this.state.focusIndex }
        scrollFocusedIntoView={ this.state.scrollFocusedIntoView }
        ref="suggestions"
        suggestions={this.state.suggestions}
        onSelect={this.addMention}
        onMouseDown={this.handleSuggestionsMouseDown}
        onMouseEnter={ (focusIndex) => this.setState({
          focusIndex,
          scrollFocusedIntoView: false
        }) }
        isLoading={this.isLoading()}
        onClose={this.resetFocusIndex}/>
    );
  };

  onCaretPositionChange = (position) => {
    this.setState({ caretPosition: position });
  };

  renderHighlighter = (inputStyle) => {
    const { selectionStart, selectionEnd } = this.state;
    const { markup, displayTransform, singleLine, children, value, style, appendedTextElements } = this.props;

    return (
      <Highlighter
        ref="highlighter"
        style={ style("highlighter") }
        inputStyle={ inputStyle }
        value={ value }
        markup={ markup }
        displayTransform={ displayTransform }
        singleLine={ singleLine }
        selection={{
          start: selectionStart,
          end: selectionEnd
        }}
        onCaretPositionChange={ this.onCaretPositionChange }
        appendedTextElements={ appendedTextElements }>

        { children }
      </Highlighter>
    );
  };

  // Returns the text to set as the value of the textarea with all markups removed
  getPlainText = () => {
    return utils.getPlainText(
      this.props.value || "",
      this.props.markup,
      this.props.displayTransform
    );
  };

  executeOnChange = (event, ...args) => {
    if(this.props.onChange) {
      return this.props.onChange(event, ...args);
    }

    if(this.props.valueLink) {
      return this.props.valueLink.requestChange(event.target.value, ...args);
    }
  };

  // Handle input element's change event
  handleChange = (ev) => {

    if(document.activeElement !== ev.target) {
      // fix an IE bug (blur from empty input element with placeholder attribute trigger "input" event)
      return;
    }

    let value = this.props.value || "";
    let newPlainTextValue = ev.target.value;

    // Derive the new value to set by applying the local change in the textarea's plain text
    let newValue = utils.applyChangeToValue(
      value, this.props.markup,
      newPlainTextValue,
      this.state.selectionStart, this.state.selectionEnd,
      ev.target.selectionEnd,
      this.props.displayTransform
    );

    // In case a mention is deleted, also adjust the new plain text value
    newPlainTextValue = utils.getPlainText(newValue, this.props.markup, this.props.displayTransform);

    // Save current selection after change to be able to restore caret position after rerendering
    let selectionStart = ev.target.selectionStart;
    let selectionEnd = ev.target.selectionEnd;
    let setSelectionAfterMentionChange = false;

    // Adjust selection range in case a mention will be deleted by the characters outside of the
    // selection range that are automatically deleted
    let startOfMention = utils.findStartOfMentionInPlainText(value, this.props.markup, selectionStart, this.props.displayTransform);

    if(startOfMention !== undefined && this.state.selectionEnd > startOfMention) {
      // only if a deletion has taken place
      selectionStart = startOfMention + 1;
      selectionEnd = selectionStart;
      setSelectionAfterMentionChange = true;
    }

    this.setState({
      selectionStart: selectionStart,
      selectionEnd: selectionEnd,
      setSelectionAfterMentionChange: setSelectionAfterMentionChange,
    });

    let mentions = utils.getMentions(newValue, this.props.markup);

    // Propagate change
    // let handleChange = this.getOnChange(this.props) || emptyFunction;
    let eventMock = { target: { value: newValue } };
    // this.props.onChange.call(this, eventMock, newValue, newPlainTextValue, mentions);
    this.executeOnChange(eventMock, newValue, newPlainTextValue, mentions);
  };

  // Handle input element's select event
  handleSelect = (ev) => {
    // do nothing while a IME composition session is active
    if (isComposing) return;

    // keep track of selection range / caret position
    this.setState({
      selectionStart: ev.target.selectionStart,
      selectionEnd: ev.target.selectionEnd
    });

    // refresh suggestions queries
    const el = this.refs.input;
    if(ev.target.selectionStart === ev.target.selectionEnd) {
      this.updateMentionsQueries(el.value, ev.target.selectionStart);
    } else {
      this.clearSuggestions();
    }

    // sync highlighters scroll position
    this.updateHighlighterScroll();

    this.props.onSelect(ev);
  };

  handleKeyDown = (ev) => {
    // do not intercept key events if the suggestions overlay is not shown
    const suggestionsCount = utils.countSuggestions(this.state.suggestions);

    const suggestionsComp = this.refs.suggestions;
    if(suggestionsCount === 0 || !suggestionsComp) {
      this.props.onKeyDown(ev);

      return;
    }

    if(values(KEY).indexOf(ev.keyCode) >= 0) {
      ev.preventDefault();
    }

    switch(ev.keyCode) {
      case KEY.ESC: {
        this.clearSuggestions();
        break;
      }
      case KEY.DOWN: {
        this.shiftFocus(+1);
        break;
      }
      case KEY.UP: {
        this.shiftFocus(-1);
        break;
      }
      case KEY.SPACE:
      case KEY.RETURN: {
        this.selectFocused();
        break;
      }
      case KEY.TAB: {
        this.selectFocused();
        break;
      }
    }

    this.props.onKeyDown(ev);
  };

  shiftFocus = (delta) => {
    let suggestionsCount = utils.countSuggestions(this.state.suggestions);

    this.setState({
      focusIndex: (suggestionsCount + this.state.focusIndex + delta) % suggestionsCount,
      scrollFocusedIntoView: true
    });
  };

  selectFocused = () => {
    let { suggestions, focusIndex } = this.state;
    let { suggestion, descriptor } = utils.getSuggestion(suggestions, focusIndex);

    this.addMention(suggestion, descriptor);

    this.setState({
      focusIndex: 0
    });
  };

  handleBlur = (ev) => {
    const clickedSuggestion = this._suggestionsMouseDown
    this._suggestionsMouseDown = false;

    // only reset selection if the mousedown happened on an element
    // other than the suggestions overlay
    if(!clickedSuggestion) {
      this.setState({
        selectionStart: null,
        selectionEnd: null
      });
    };

    window.setTimeout(() => {
      this.updateHighlighterScroll();
    }, 1);

    this.props.onBlur(ev, clickedSuggestion);
  };

  handleSuggestionsMouseDown = (ev) => {
    this._suggestionsMouseDown = true;
  };

  updateSuggestionsPosition = () => {
    let { caretPosition } = this.state;

    if(!caretPosition || !this.refs.suggestions) {
      return;
    }

    let { container } = this.refs;

    let suggestions = ReactDOM.findDOMNode(this.refs.suggestions);

    if(!suggestions) {
      return;
    }

    let highlighter = ReactDOM.findDOMNode(this.refs.highlighter);

    let left = caretPosition.left - highlighter.scrollLeft;
    let position = {};

    // guard for mentions suggestions list clipped by right edge of window
    if (left + suggestions.offsetWidth > container.offsetWidth) {
      position.right = 0;
    } else {
      position.left = left
    }

    // bearyfix: the suggestions is shown on the top of the caret
    const { height: suggestionsHeight } = suggestions.getBoundingClientRect();
    const { lineHeight: inputLineHeightStyle } = window.getComputedStyle(this.refs.input, false);
    const inputLineHeight = parseFloat(inputLineHeightStyle) / 2;

    position.top = -(suggestionsHeight + inputLineHeight) + (caretPosition.top - highlighter.scrollTop);

    if(isEqual(position, this.state.suggestionsPosition)) {
      return;
    }

    this.setState({
      suggestionsPosition: position
    });
  };

  updateHighlighterScroll = () => {
    if(!this.refs.input || !this.refs.highlighter) {
      // since the invocation of this function is deferred,
      // the whole component may have been unmounted in the meanwhile
      return;
    }
    const input = this.refs.input;
    const highlighter = ReactDOM.findDOMNode(this.refs.highlighter);
    highlighter.scrollLeft = input.scrollLeft;
    highlighter.scrollTop = input.scrollTop;
  };

  handleCompositionStart = () => {
    isComposing = true;
  };

  handleCompositionEnd = () => {
    isComposing = false;
  };

  // bearyfix: the highlighter should keep in sync with the input as the input is being scrolled
  syncHighlighterScrolling = () => {
    if (this.props.singleLine) {
      return;
    }

    this.scrollListener = () => requestAnimationFrame(() => {
      this.updateHighlighterScroll();
      this.updateSuggestionsPosition();
    });

    this.refs.input.addEventListener('scroll', this.scrollListener);
  };

  componentDidMount() {
    this.updateSuggestionsPosition();
    this.syncHighlighterScrolling();

    this.refs.input.addEventListener('keydown', this.handleKeyDown);
  }

  componentDidUpdate() {
    this.updateSuggestionsPosition();

    // maintain selection in case a mention is added/removed causing
    // the cursor to jump to the end
    if (this.state.setSelectionAfterMentionChange) {
      this.setState({setSelectionAfterMentionChange: false});
      this.setSelection(this.state.selectionStart, this.state.selectionEnd);
    }
  }

  componentWillUnmount() {
    this.refs.input.removeEventListener('keydown', this.handleKeyDown);
    if (this.scrollListener) {
      this.refs.input.removeEventListener('scroll', this.scrollListener);
    }
  }

  componentWillReceiveProps(nextProps) {
    const isSelectionControlled = nextProps.selectionStart !== undefined && nextProps.selectionEnd !== undefined;

    if (isSelectionControlled && nextProps.resetSelection) {
      this.setState({
        setSelectionAfterMentionChange: nextProps.resetSelection,
        selectionStart: nextProps.selectionStart,
        selectionEnd: nextProps.selectionEnd
      });
    }
  }

  setSelection = (selectionStart, selectionEnd) => {
    if(selectionStart === null || selectionEnd === null) return;

    const el = this.refs.input;
    this.refs.input.focus();
    if(el.setSelectionRange) {
      el.setSelectionRange(selectionStart, selectionEnd);
    }
    else if(el.createTextRange) {
      const range = el.createTextRange();
      range.collapse(true);
      range.moveEnd('character', selectionEnd);
      range.moveStart('character', selectionStart);
      range.select();
    }
  };

  updateMentionsQueries = (plainTextValue, caretPosition) => {
    // Invalidate previous queries. Async results for previous queries will be neglected.
    this._queryId++;
    this.suggestions = {};
    this.setState({
      suggestions: {}
    });

    // If caret is inside of or directly behind of mention, do not query
    const value = this.props.value || "";
    if( utils.isInsideOfMention(value, this.props.markup, caretPosition, this.props.displayTransform) ||
        utils.isInsideOfMention(value, this.props.markup, caretPosition-1, this.props.displayTransform) ) {
      return;
    }

    // Check if suggestions have to be shown:
    // Match the trigger patterns of all Mention children the new plain text substring up to the current caret position
    const substring = plainTextValue.substring(0, caretPosition);

    this.state.dataSources.forEach(child => {
      if (!child) {
        return
      }

      const regex = _getTriggerRegex(child.props.trigger, this.props)
      const match = substring.match(regex)
      if (match) {
        const querySequenceStart = substring.indexOf(match[1], match.index)
        this.queryData(match[2], child, querySequenceStart, querySequenceStart+match[1].length, plainTextValue)
      }
    })
  }

  clearSuggestions = () => {
    // Invalidate previous queries. Async results for previous queries will be neglected.
    this._queryId++;
    this.suggestions = {};
    this.setState({
      suggestions: {},
      focusIndex: 0
    });
  };

  queryData = (query, mentionDescriptor, querySequenceStart, querySequenceEnd, plainTextValue) => {
    const provideData = _getDataProvider(mentionDescriptor.props.data);
    const snycResult = provideData(query, this.updateSuggestions.bind(null, this._queryId, mentionDescriptor, query, querySequenceStart, querySequenceEnd, plainTextValue));
    if(snycResult instanceof Array) {
      this.updateSuggestions(this._queryId, mentionDescriptor, query, querySequenceStart, querySequenceEnd, plainTextValue, snycResult);
    }
  };

  updateSuggestions = (queryId, mentionDescriptor, query, querySequenceStart, querySequenceEnd, plainTextValue, suggestions) => {
    // neglect async results from previous queries
    if(queryId !== this._queryId) return;

    const groups = groupBy(suggestions, mentionDescriptor.props.groupBy);
    const groupedSuggestions = flatten(values(groups));

    const update = {};
    update[mentionDescriptor.props.type] = {
      query: query,
      mentionDescriptor: mentionDescriptor,
      querySequenceStart: querySequenceStart,
      querySequenceEnd: querySequenceEnd,
      results: groupedSuggestions,
      plainTextValue: plainTextValue
    };

    // save in property so that multiple sync state updates from different mentions sources
    // won't overwrite each other
    this.suggestions = utils.extend({}, this.suggestions, update)
    const { focusIndex } = this.state
    const suggestionsCount = utils.countSuggestions(this.suggestions)
    this.setState({
      suggestions: this.suggestions,
      suggestionsClassNameModifier: mentionDescriptor.props.modifier,
      focusIndex: focusIndex >= suggestionsCount ? Math.max(suggestionsCount - 1, 0) : focusIndex,
    });
  };

  addMention = (suggestion, {mentionDescriptor, querySequenceStart, querySequenceEnd, plainTextValue}) => {
    // Insert mention in the marked up value at the correct position
    const value = this.props.value || "";
    const start = utils.mapPlainTextIndex(value, this.props.markup, querySequenceStart, 'START', this.props.displayTransform);
    const end = start + querySequenceEnd - querySequenceStart;
    let insert = utils.makeMentionsMarkup(this.props.markup, suggestion.id, suggestion.display, mentionDescriptor.props.type, this.props.compileMarkup);
    if (mentionDescriptor.props.appendSpaceOnAdd) {
      insert = insert + ' '
    }
    const newValue = utils.spliceString(value, start, end, insert);

    // Refocus input and set caret position to end of mention
    this.refs.input.focus();

    let displayValue = this.props.displayTransform(suggestion.id, suggestion.display, mentionDescriptor.props.type);
    if (mentionDescriptor.props.appendSpaceOnAdd) {
      displayValue = displayValue + ' '
    }
    const newCaretPosition = querySequenceStart + displayValue.length;
    this.setState({
      selectionStart: newCaretPosition,
      selectionEnd: newCaretPosition,
      setSelectionAfterMentionChange: true
    });

    // Propagate change
    const eventMock = { target: { value: newValue }};
    const mentions = utils.getMentions(newValue, this.props.markup);
    const newPlainTextValue = utils.spliceString(plainTextValue, querySequenceStart, querySequenceEnd, displayValue);

    this.executeOnChange(eventMock, newValue, newPlainTextValue, mentions);

    const onAdd = mentionDescriptor.props.onAdd;
    if(onAdd) {
      onAdd(suggestion.id, suggestion.display);
    }

    // Make sure the suggestions overlay is closed
    this.clearSuggestions();
  };

  isLoading = () => {
    let isLoading = false;
    this.state.dataSources.forEach(function(child) {
      isLoading = isLoading || child && child.props.isLoading;
    });
    return isLoading;
  };

  _queryId = 0;
}

const isMobileSafari = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

const styled = defaultStyle({
  position: "relative",
  overflowY: "visible",

  input: {
    display: "block",
    position: "absolute",

    top: 0,

    boxSizing: "border-box",

    backgroundColor: "transparent",

    width: "inherit",
  },

  '&multiLine': {
    input: {
      width: "100%",
      height: "100%",
      bottom: 0,
      // bearyfix: allow input to scroll
      // overflow: "hidden",
      resize: "none",

      // fix weird textarea padding in mobile Safari (see: http://stackoverflow.com/questions/6890149/remove-3-pixels-in-ios-webkit-textarea)
      ...(isMobileSafari ? {
        marginTop: 1,
        marginLeft: -3,
      } : null)
    }
  }
}, ({ singleLine }) => ({
  "&singleLine": singleLine,
  "&multiLine": !singleLine,
}));

export default styled(MentionsInput);
