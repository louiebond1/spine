import {registerRoot, Composition} from 'remotion';
import React from 'react';
import {Interaction} from './Interaction';
import {Poc} from './Poc';
registerRoot(() => <>
  <Composition id="Interaction" component={Interaction} durationInFrames={240} fps={30} width={1920} height={1080}/>
  <Composition id="GeometryTest" component={Poc} durationInFrames={372} fps={30} width={1920} height={1080}
    defaultProps={{plate: 'testcard.png', plateW: 2752, plateH: 1536, quad: [[1130,330],[2250,410],[2230,1050],[1120,1010]], caption: null}}/>
</>);
