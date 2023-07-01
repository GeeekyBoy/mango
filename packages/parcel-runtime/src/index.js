/**
 * Copyright (c) GeeekyBoy
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Runtime } from "@parcel/plugin";

export default new Runtime({
  async apply({ bundle, bundleGraph }) {
    if (bundle.getMainEntry()?.query.has('component')) {
      const styleSheets = bundleGraph.getReferencedBundles(bundle).filter(b => b.type === 'css').map(b => b.name);
      if (styleSheets.length) {
        const styleSheetLoader = `
          var publicUrl = ${JSON.stringify(bundle.target.publicUrl)};
          var styleSheetsToLoad = ${JSON.stringify(styleSheets)};
          var styleSheets = document.styleSheets;
          var styleSheetsLength = styleSheets.length;
          for (var i = 0; i < styleSheetsToLoad.length; i++) {
            var isLoaded = false;
            for (var j = 0; j < styleSheetsLength; j++) {
              if (styleSheets[j].href === window.location.origin + publicUrl + styleSheetsToLoad[i]) {
                isLoaded = true;
                break;
              }
            }
            if (!isLoaded) {
              var link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = publicUrl + styleSheetsToLoad[i];
              document.getElementsByTagName("head")[0].appendChild(link);
            }
          }
        `;
        return [{
          filePath: 'styleSheetLoader.js',
          code: styleSheetLoader,
          isEntry: true,
        }]
      }
    }
  },
});
