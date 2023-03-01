# PWA Studio - Infinite Category Scroll

An extension that replaces the default pagination with infinite scroll on category pages. 

This project was originally developed as an example of how to extend PWA studio therefore the code is heavily commented. You can read the companion blog post here: https://peterford.dev/pwa-studio-infinite-category-scroll/

## Installation

yarn add @peterforddev/infinite-category-scroll

Inside your copy of PWA Studio add the following to your local-intercept.js file:

```js
const infiniteScrollIntercept = require('@peterforddev/infinite-category-scroll/src/targets/extend-intercept');

function localIntercept(targets) {
    infiniteScrollIntercept(targets);
}
