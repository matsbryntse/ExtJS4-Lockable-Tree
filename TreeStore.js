Ext.define('FixedTreeStore', {
    extend: 'Ext.data.TreeStore',

    constructor: function (config) {
        this.addEvents(
                'root-fill-start',
                'root-fill-end',

        /**
        * Will be fired on the call to `filter` method
        * @event filter
        * @param {Gnt.data.TaskStore} self This task store
        * @param {Object} args The arguments passed to `filter` method
        */
                'filter',

        /**
        * Will be fired on the call to `clearFilter` method
        * @event clearfilter
        * @param {Gnt.data.TaskStore} self This task store
        * @param {Object} args The arguments passed to `clearFilter` method
        */
                'clearfilter'
            );

        config = config || {};

        // need to init the "hasListeners" hash
        this.hasListeners = {};

        this.callParent([config]);
    },

    setRootNode: function () {
        var me = this;

        this.tree.setRootNode = Ext.Function.createInterceptor(this.tree.setRootNode, function (rootNode) {

            Ext.apply(rootNode, {
                // HACK Prevent tree store from trying to 'create' the root node
                phantom: false,
                dirty: false
            });
        });

        var res = this.callParent(arguments);

        delete this.tree.setRootNode;

        return res;
    },

    // much faster implementation of `fillNode` method for buffered case which uses `node.appendChild` with `suppressEvent` option
    // and bypasses all the events fireing/bubbling machinery, calling the `onNodeAdded` directly
    fillNode: function (node, records) {
        this.isFillingNode = true;

        if (node.isRoot()) {
            this.isFillingRoot = true;

            //            console.profile('fillRoot')
            //            console.time('fillRoot')
            this.fireEvent('root-fill-start', this, node, records);
        }

        var me = this,
            ln = records ? records.length : 0,
            i = 0, sortCollection;

        if (ln && me.sortOnLoad && !me.remoteSort && me.sorters && me.sorters.items) {
            sortCollection = Ext.create('Ext.util.MixedCollection');
            sortCollection.addAll(records);
            sortCollection.sort(me.sorters.items);
            records = sortCollection.items;
        }

        node.set('loaded', true);

        if (this.buffered) {

            for (; i < ln; i++) {
                var record = records[i];
                record.__isFilling__ = true;

                // suppress the events -------|
                //                           \/            
                node.appendChild(record, true, true);

                // directly call 'onNodeAdded'
                this.onNodeAdded(null, record);

                // register the node in tree (for `getNodeById` to work properly)
                this.tree.registerNode(record);
            }
        } else {
            for (; i < ln; i++) {
                // this will prevent `getModifiedFieldNames` from doing costly
                // isDate comparison 100000 times (for 1000 records)
                // see the override trick for `getModifiedFieldNames` 
                records[i].__isFilling__ = true;

                node.appendChild(records[i], false, true);
            }
        }

        if (node.isRoot()) {
            this.getRootNode().cascadeBy(function (record) {
                delete record.__isFilling__;
            });

            this.isFillingRoot = false;

            //            console.profileEnd('fillRoot')
            //            console.timeEnd('fillRoot')
            this.fireEvent('root-fill-end', this, node, records);
        }

        delete this.isFillingNode;
        return records;
    }
});
