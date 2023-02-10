module.exports = (targets) => {
    // Wrap the useProductFullDetail talon with this extension
    const peregrineTargets = targets.of("@magento/peregrine");
    const talonsTarget = peregrineTargets.talons;

    // Set the buildpack features required by this extension
    const builtins = targets.of("@magento/pwa-buildpack");
    builtins.specialFeatures.tap((featuresByModule) => {
        featuresByModule["@peterforddev/infinite-category-scroll"] = {
            // Wrapper modules must be ES Modules
            esModules: true,
        };
    });


    talonsTarget.tap((talonWrapperConfig) => {
        talonWrapperConfig.RootComponents.Category.useCategory.wrapWith('@peterforddev/infinite-category-scroll/src/targets/wrapUseCategory');
    });
    //
    // talonsTarget.tap(({Category}) => {
    //     Category.useCategory.wrapWith("./wrapUseCategory",);
    // });
};
