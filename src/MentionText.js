import React, { PureComponent } from 'react';

class MentionText extends PureComponent {
  render() {
    const { display } = this.props;
    return (
      <strong>
        { display }
      </strong>
    );
  }
}

export default MentionText;
