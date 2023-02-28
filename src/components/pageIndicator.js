import React from "react";
import classes from "./pageIndicator.module.css";
const PageIndicator = props => {
    const {currentCount, totalCount} = props;

    const pageIndicator = `Showing ${currentCount} of ${totalCount} products`;

    return (
        <div className={classes.root}>
            {pageIndicator}
        </div>
    );
}

export default PageIndicator;
