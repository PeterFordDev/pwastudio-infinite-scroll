const {Targetables} = require('@magento/pwa-buildpack');
const React = require("react");

module.exports = targets => {
    const targetables = Targetables.using(targets);


    const CategoryRootComponent = targetables.reactComponent(
        '@magento/venia-ui/lib/RootComponents/Category/category.js'
    );

    const CategoryContentComponent = targetables.reactComponent(
        '@magento/venia-ui/lib/RootComponents/Category/categoryContent.js'
    );

    CategoryRootComponent.appendJSX(
        `<Fragment>`,
        `<div ref={talonProps.endOfProductListRef} />`,
    );

    CategoryContentComponent.addImport(
        `import PageIndicator from '@peterforddev/infinite-category-scroll/src/components/pageIndicator';`
    )

    CategoryContentComponent.replaceJSX(
        `<div className={classes.pagination}>{pagination}</div>`,
        `<PageIndicator currentCount={items.length} totalCount={totalCount}/>`
    )
};
