import {useEffect, useMemo, useRef, useState} from 'react';
import {useLazyQuery, useQuery} from "@apollo/client";
import {useLocation} from "react-router-dom";
import mergeOperations from '@magento/peregrine/lib/util/shallowMerge';
import {useAppContext} from '@magento/peregrine/lib/context/app';
import {usePagination} from '@magento/peregrine/lib/hooks/usePagination';
import {useSort} from '@magento/peregrine/lib/hooks/useSort';
import useOnScreen from "../hooks/useOnScreen";

import {
    getFiltersFromSearch,
    getFilterInput
} from '@magento/peregrine/lib/talons/FilterModal/helpers';

import DEFAULT_OPERATIONS from '@magento/peregrine/lib/talons/RootComponents/Category/category.gql';


const wrapUseCategory = (original) => {
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

        const pageControl = {
            currentPage,
            setPage: setCurrentPage,
            totalPages
        };

        const [
            ,
            {
                actions: {setPageLoading}
            }
        ] = useAppContext();

        // Infinite scroll code
        // store category data in state so we can retain between renders
        const [categoryData, setCategoryData] = useState(null);

        // check whether user has loaded page 1 initially or not, we will use this to determine what products to query for on the first render
        const [isPageOneInitialRender, setIsPageOneInitialRender] = useState(currentPage === 1);

        // Create a ref that we return to the category component and we will add it to the end of the product list in the DOM
        const endOfProductListRef = useRef(null);

        // Check if the end of the product list is in the viewport
        const isInView = useOnScreen(endOfProductListRef);

        // Update the current page when the end of the product list is in the viewport
        useEffect(() => {
            // only run if we are not on the last page
            if (isInView && currentPage < totalPages) {
                setCurrentPage(currentPage + 1);
            }
        }, [isInView]);

        const handleUpdateProductData = data => {
            // if current page is 1 , we can't just check for previous data as if the user as changed the filters there could already
            // be data in state but we want to reset not append the filtered data to the current.
            if (currentPage === 1) {
                setCategoryData(data)
            } else {
                setCategoryData(prev => {
                    // if there is no previous data return the new data (happens on initial load && page doesn't equal 1)
                    if (!prev) {
                        return data;
                    }

                    // @todo: this is a temporary fix for when we load the page on a page number other than page one, the filterTypeMap value updates twice causing runQuery to run twice,
                    // We check if the last product in the previous data is the same as the last product in the new data and if it is we return the previous data so we don't append the same products twice
                    if (prev.products.items[prev.products.items.length - 1].sku === data.products.items[data.products.items.length - 1].sku) {
                        return prev;
                    }

                    // create one array with all of the products from the previous and the new data
                    const itemsJoined = prev.products.items.concat(data.products.items);

                    // return the new data with the new products array
                    return {
                        ...data,
                        products: {
                            items: itemsJoined,
                            totalPages: data.products.totalPages,
                            page_info: data.products.page_info,
                            total_count: data.products.total_count
                        }
                    };
                });
            }

            // reset the initial render flag so next time we query we get the default amount of products
            setIsPageOneInitialRender(true)
        }

        const [runQuery, queryResponse] = useLazyQuery(getCategoryQuery, {
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
            onCompleted: data => handleUpdateProductData(data)
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

            // If the user has not loaded page 1 initially, we need to multiply the current page by the page size to get the correct number of products
            runQuery({
                variables: {
                    currentPage: isPageOneInitialRender ? Number(currentPage) : 1,
                    id: id,
                    filters: newFilters,
                    pageSize: Number(isPageOneInitialRender ? pageSize : currentPage * pageSize), // Multiply by initial page to get the correct number of products
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
            categoryLoading ||
            introspectionLoading;

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
    }
};

export default wrapUseCategory;
