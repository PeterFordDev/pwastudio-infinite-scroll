# PWA Studio - Infinite Category Scroll

An extension that replaces the default pagination with infinite scroll on category pages. 

This project was originally developed as an example of how to extend PWA studio therefore the code is heavily commented. You can read the companion blog post here: https://peterford.dev/pwa-studio-infinite-scroll-extension/

## Installation

Make a copy of this folder and install add module to your PWA studio project's package.json:

````json
{
"dependencies": {
    "@peterforddev/infinite-category-scroll": "file:../path-to-folder"
  }
}
````

Inside your copy of PWA Studio add the following to your local-intercept.js file:

```js
const infiniteScrollIntercept = require('@peterforddev/infinite-category-scroll/src/targets/extend-intercept');

function localIntercept(targets) {
    infiniteScrollIntercept(targets);
}
