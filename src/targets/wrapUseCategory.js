import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {useLazyQuery, useQuery} from '@apollo/client';

import mergeOperations from '@magento/peregrine/lib/util/shallowMerge';
import {useAppContext} from '@magento/peregrine/lib/context/app';
import {usePagination} from '@magento/peregrine/lib/hooks/usePagination';
import {useSort} from '@magento/peregrine/lib/hooks/useSort';
import {
    getFiltersFromSearch,
    getFilterInput
} from '@magento/peregrine/lib/talons/FilterModal/helpers';

import DEFAULT_OPERATIONS from '@magento/peregrine/lib/talons/RootComponents/Category/category.gql';
import useOnScreen from "../hooks/useOnScreen";

const wrapUseCategory = () => {
    return function useCategory(props) {

        const {
            id,
            queries: {getPageSize}
        } = props;

        const operations = mergeOperations(DEFAULT_OPERATIONS, props.operations);
        const {getCategoryQuery, getFilterInputsQuery} = operations;

        const {data: pageSizeData} = useQuery(getPageSize, {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first'
        });
        const pageSize = pageSizeData && pageSizeData.storeConfig.grid_per_page;

        const [paginationValues, paginationApi] = usePagination();
        const {currentPage, totalPages} = paginationValues;
        const {setCurrentPage, setTotalPages} = paginationApi;

        const sortProps = useSort({sortFromSearch: false});
        const [currentSort] = sortProps;

        // Keep track of the sort criteria so we can tell when they change.
        const previousSort = useRef(currentSort);

        // Create a ref for then end of product list so we can fetch more products
        const endOfProductListRef = useRef(null);


        // Check if the end of the product list is in view
        const isInView = useOnScreen(endOfProductListRef);

        console.log('isInView', isInView);

        const pageControl = {
            currentPage,
            setPage: setCurrentPage,
            totalPages
        };

        useEffect(() => {
            if (isInView && currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
            }
        }, [isInView]);


        const [
            ,
            {
                actions: {setPageLoading}
            }
        ] = useAppContext();

        const [runQuery, queryResponse] = useLazyQuery(getCategoryQuery, {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first'
        });
        const {
            called: categoryCalled,
            loading: categoryLoading,
            error,
            data
        } = queryResponse;
        const {search} = useLocation();

        const isBackgroundLoading = !!data && categoryLoading;

        // Update the page indicator if the GraphQL query is in flight.
        useEffect(() => {
            setPageLoading(isBackgroundLoading);
        }, [isBackgroundLoading, setPageLoading]);

        // Keep track of the search terms so we can tell when they change.
        const previousSearch = useRef(search);

        // Get "allowed" filters by intersection of schema and aggregations
        const {
            called: introspectionCalled,
            data: introspectionData,
            loading: introspectionLoading
        } = useQuery(getFilterInputsQuery, {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first'
        });

        // Create a type map we can reference later to ensure we pass valid args
        // to the graphql query.
        // For example: { category_id: 'FilterEqualTypeInput', price: 'FilterRangeTypeInput' }
        const filterTypeMap = useMemo(() => {
            const typeMap = new Map();
            if (introspectionData) {
                introspectionData.__type.inputFields.forEach(({name, type}) => {
                    typeMap.set(name, type.name);
                });
            }
            return typeMap;
        }, [introspectionData]);

        // Run the category query immediately and whenever its variable values change.
        useEffect(() => {
            // Wait until we have the type map to fetch product data.
            if (!filterTypeMap.size || !pageSize) {
                return;
            }

            const filters = getFiltersFromSearch(search);

            // Construct the filter arg object.
            const newFilters = {};
            filters.forEach((values, key) => {
                newFilters[key] = getFilterInput(values, filterTypeMap.get(key));
            });

            // Use the category uid for the current category page regardless of the
            // applied filters. Follow-up in PWA-404.
            newFilters['category_uid'] = {eq: id};

            runQuery({
                variables: {
                    currentPage: Number(currentPage),
                    id: id,
                    filters: newFilters,
                    pageSize: Number(pageSize),
                    sort: {[currentSort.sortAttribute]: currentSort.sortDirection}
                }
            });
        }, [
            currentPage,
            currentSort,
            filterTypeMap,
            id,
            pageSize,
            runQuery,
            search
        ]);

        const totalPagesFromData = data
            ? data.products.page_info.total_pages
            : null;

        useEffect(() => {
            setTotalPages(totalPagesFromData);
            return () => {
                setTotalPages(null);
            };
        }, [setTotalPages, totalPagesFromData]);

        // If we get an error after loading we should try to reset to page 1.
        // If we continue to have errors after that, render an error message.
        useEffect(() => {
            if (error && !categoryLoading && !data && currentPage !== 1) {
                setCurrentPage(1);
            }
        }, [currentPage, error, categoryLoading, setCurrentPage, data]);

        // Reset the current page back to one (1) when the search string, filters
        // or sort criteria change.
        useEffect(() => {
            // We don't want to compare page value.
            const prevSearch = new URLSearchParams(previousSearch.current);
            const nextSearch = new URLSearchParams(search);
            prevSearch.delete('page');
            nextSearch.delete('page');

            if (
                prevSearch.toString() !== nextSearch.toString() ||
                previousSort.current.sortAttribute.toString() !==
                currentSort.sortAttribute.toString() ||
                previousSort.current.sortDirection.toString() !==
                currentSort.sortDirection.toString()
            ) {
                // The search term changed.
                setCurrentPage(1, true);
                // And update the ref.
                previousSearch.current = search;
                previousSort.current = currentSort;
            }
        }, [currentSort, previousSearch, search, setCurrentPage]);


        // store category data in state so we can append newly fetched data
        const [categoryData, setCategoryData] = useState(null);
        useEffect(() => {
            if (!categoryLoading && data) {
                setCategoryData(prev => {
                    // if there is no previous data, return the new data
                    if (!prev) {
                        return data;
                    }

                    // create one array with all of the products from previous and new data
                    const itemsJoined = prev.products.items.concat(data.products.items);

                    return {
                        ...data,
                        products: {
                            items: itemsJoined,
                            totalPages: data.products.totalPages,
                            page_info: data.products.page_info,
                        }
                    };
                });
            }
        }, [categoryLoading, data]);

        const categoryNotFound =
            !categoryLoading && data && data.categories.items.length === 0;
        const metaDescription =
            data &&
            data.categories.items[0] &&
            data.categories.items[0].meta_description
                ? data.categories.items[0].meta_description
                : '';

        // When only categoryLoading is involved, noProductsFound component flashes for a moment
        const loading =
            (introspectionCalled && !categoryCalled) ||
            (categoryLoading && !data) ||
            introspectionLoading;

        // useScrollTopOnChange(currentPage);

        return {
            error,
            categoryData,
            loading,
            metaDescription,
            pageControl,
            sortProps,
            pageSize,
            categoryNotFound,
            endOfProductListRef
        };
    };
};

export default wrapUseCategory;
