import React from 'react';
import { defaultStyle } from 'substyle';

const styled = defaultStyle({
  fontWeight: "inherit"
});

const Mention = styled(({ display, style }) => (
  <strong {...style}>
    { display }
  </strong>
));

export default Mention;
