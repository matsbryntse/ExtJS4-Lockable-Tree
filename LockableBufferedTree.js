Ext.grid.Lockable.override({

    injectLockable: function () {

        var me = this;
        var isTree = me.store instanceof Ext.data.TreeStore;
        var isBuffered = me.store.buffered;

        me.normalGridConfig = me.schedulerConfig || me.normalGridConfig || {};

        me.bothCfgCopy = me.bothCfgCopy || [];


        me.lockedViewConfig = me.lockedViewConfig || {};
        me.normalViewConfig = me.normalViewConfig || {};

        me.lockedViewConfig.enableAnimations = me.normalViewConfig.enableAnimations = false;

        if (isTree) {
            // re-use the same NodeStore for both grids (construction of NodeStore is an expensive operation, shouldn't just unbind the extra one)
            me.normalViewConfig.providedStore = me.lockedViewConfig.providedStore = me.createNodeStore(isBuffered, me.store);
        }

        // Grids instantiation
        this.callParent(arguments);

        // At this point, the 2 child grids are created
        // Now post processing, changing and overriding some things that Ext.grid.Lockable sets up

        var lockedView = me.lockedGrid.getView();
        var normalView = me.normalGrid.getView();

        // Buffered support for locked grid
        if (isBuffered) {
            lockedView.on('render', this.onLockedViewRender, this);
        }

        if (isTree) {
            this.setupLockableTree();
        }

        if (this.lockedGrid.view.store !== this.normalGrid.view.store) {
            Ext.Error.raise('Sch.mixin.Lockable setup failed, not sharing store between the two views');
        }
    },

    createNodeStore: function (isBuffered, treeStore) {
        return new Ext.data.NodeStore({
            buffered: isBuffered,

            // never purge any data, we prefetch all up front
            purgePageCount: 0,
            pageSize: 1e10,

            treeStore: treeStore,
            recursive: true,

            refreshFromTree: function () {
                var eventsWereSuspended = this.eventsSuspended;

                this.suspendEvents();

                this.removeAll();

                var root = treeStore.getRootNode(),
                    linearNodes = [];

                var collectNodes = function (node) {
                    if (node != root) {
                        linearNodes[linearNodes.length] = node;
                    }

                    if (node.isExpanded()) {
                        var childNodes = node.childNodes,
                            length = childNodes.length;

                        for (var k = 0; k < length; k++) {
                            collectNodes(childNodes[k]);
                        }
                    }
                };

                collectNodes(root);

                this.totalCount = linearNodes.length;

                this.cachePage(linearNodes, 1);

                if (!eventsWereSuspended) {
                    this.resumeEvents();
                }
            }
        });
    },


    setupLockableTree: function () {
        var oldRootNode;
        var fillingRoot;

        var me = this;

        var isBuffered = me.store.buffered;
        var topView = me.getView();
        var lockedView = me.lockedGrid.getView();
        var normalView = me.normalGrid.getView();
        var normalStore = normalView.store;
        var treeStore = me.store;

        var verticalScroller = me.normalGrid.verticalScroller;

        // this function is covered with "203_buffered_view_2.t.js" in Gantt
        var guaranteeRange = function (rangeStart, rangeEnd) {
            var pageSize = treeStore.viewSize || 50;
            var totalCount = normalStore.getTotalCount();

            if (totalCount) {
                var rangeLength = rangeEnd - rangeStart + 1;

                // if current range is less than a page size but in total we have at least one full page
                if (rangeLength < pageSize && totalCount >= rangeLength) {

                    // then expand the range till the page size
                    rangeEnd = rangeStart + pageSize - 1;
                }

                // if the end of range goes after limit
                if (rangeEnd >= totalCount) {
                    // then adjust it
                    rangeStart = totalCount - (rangeEnd - rangeStart);
                    rangeEnd = totalCount - 1;

                    rangeStart = Math.max(0, rangeStart);
                }

                normalStore.guaranteeRange(rangeStart, rangeEnd);
            }
        };

        treeStore.on('root-fill-start', function () {
            fillingRoot = true;

            normalStore.suspendEvents();

            if (isBuffered) {
                oldRootNode = normalStore.node;

                // setting the root node of NodeStore to null - so we now should update the NodeStore manually for all CRUD operations in tree
                // with `refreshFromTree` call
                normalStore.setNode();
            }
        });

        treeStore.on('root-fill-end', function () {
            fillingRoot = false;

            if (isBuffered) {
                normalStore.refreshFromTree();

                normalStore.resumeEvents();

                guaranteeRange(0, treeStore.viewSize || 50);
            } else {
                normalStore.resumeEvents();

                topView.refresh();
            }
        });

        if (isBuffered) {
            var rangeStart, rangeEnd;

            normalStore.on('guaranteedrange', function (range, start, end) {
                rangeStart = start;
                rangeEnd = end;
            });

            var updateNodeStore = function () {
                if (fillingRoot) return;

                normalStore.refreshFromTree();

                guaranteeRange(rangeStart, rangeEnd);

                me.onNormalViewScroll();
            };

            treeStore.on({
                append: updateNodeStore,
                insert: updateNodeStore,
                remove: updateNodeStore,
                move: updateNodeStore,
                expand: updateNodeStore,
                collapse: updateNodeStore,
                sort: updateNodeStore,

                buffer: 1
            });
        }

        treeStore.on('filter', function (treeStore, args) {
            normalStore.filter.apply(normalStore, args);

            topView.refresh();
        });

        treeStore.on('clearfilter', function (treeStore) {
            normalStore.clearFilter();

            topView.refresh();
        });


        if (isBuffered && verticalScroller) {
            var prevOnGuaranteedRange = verticalScroller.onGuaranteedRange;

            // native buffering is based on the assumption, that "refresh" event
            // from the store will trigger the view refresh - thats not true for tree case 
            // (search for "blockRefresh" in Ext sources)
            // so, after "onGuaranteedRange" we need to perform view refresh manually (for both locked/normal views)
            // we are doing "light" refresh - the one, not causing any changes in layout
            verticalScroller.onGuaranteedRange = function () {
                prevOnGuaranteedRange.apply(this, arguments);

                Ext.suspendLayouts();

                normalView.refreshSize = Ext.emptyFn;
                lockedView.refreshSize = Ext.emptyFn;

                topView.refresh();

                delete normalView.refreshSize;
                delete lockedView.refreshSize;

                Ext.resumeLayouts();
            };

            // dummy object to make the "normalView.el.un()" call to work in the "bindView" below
            normalView.el = { un: function () { } };

            // re-bind the view of the scroller
            // this will:
            // 1) update the `store` of the scroller from TreeStore instance to NodeStore
            // 2) will update the listener of `guaranteedrange` event
            //    so it will use the override for `onGuaranteedRange` from above 
            verticalScroller.bindView(normalView);

            delete normalView.el;
        }
    },

    updateSpacer: function () {
        var lockedView = this.lockedGrid.getView();
        if (lockedView.rendered && lockedView.el.child('table')) {
            var me = this,
            // This affects scrolling all the way to the bottom of a locked grid
            // additional test, sort a column and make sure it synchronizes
                lockedViewEl = me.lockedGrid.getView().el,
                normalViewEl = me.normalGrid.getView().el.dom,
                spacerId = lockedViewEl.dom.id + '-spacer',
                spacerHeight = (normalViewEl.offsetHeight - normalViewEl.clientHeight) + 'px';

            // put the spacer inside of stretcher with special css class (see below), which will cause the 
            // stretcher to increase its height on the height of spacer 
            var spacerParent = this.store.buffered ? me.normalGrid.verticalScroller.stretcher.item(0) : lockedViewEl;

            me.spacerEl = Ext.getDom(spacerId);
            if (me.spacerEl) {
                me.spacerEl.style.height = spacerHeight;
            } else {
                Ext.core.DomHelper.append(spacerParent, {
                    id: spacerId,
                    cls: this.store.buffered ? 'sch-locked-buffered-spacer' : '',
                    style: 'height: ' + spacerHeight
                });
            }
        }
    },

    onLockedViewRender: function () {
        var normalGrid = this.normalGrid;

        if (!normalGrid.rendered) {
            normalGrid.getView().on('render', this.onLockedViewRender, this);

            return;
        }

        // make sure the listener for "scroll" event is the last one 
        // (it should be called _after_ same listener of the PagingScroller)
        // only relevant for IE generally, but won't hurt for other browsers too
        normalGrid.getView().el.un('scroll', this.onNormalViewScroll, this);
        normalGrid.getView().el.on('scroll', this.onNormalViewScroll, this);

        var lockedViewEl = this.lockedGrid.getView().el;

        var lockedStretcher = lockedViewEl.createChild({
            cls: 'x-stretcher',
            style: {
                position: 'absolute',
                width: '1px',
                height: 0,
                top: 0,
                left: 0
            }
        }, lockedViewEl.dom.firstChild);

        var verticalScroller = normalGrid.verticalScroller;

        verticalScroller.stretcher.addCls('x-stretcher');

        verticalScroller.stretcher = new Ext.dom.CompositeElement([lockedStretcher, verticalScroller.stretcher]);
    }
});

