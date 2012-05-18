Ext.tree.View.addMembers({

    providedStore: null,

    initComponent: function () {
        var me = this,
            treeStore = me.panel.getStore();

        if (me.initialConfig.animate === undefined) {
            me.animate = Ext.enableFx;
        }

        // BEGIN OF MODIFICATIONS
        me.store = me.providedStore || new Ext.data.NodeStore({
            treeStore: treeStore,
            recursive: true,
            rootVisible: me.rootVisible
        });

        me.store.on({
            beforeexpand: me.onBeforeExpand,
            expand: me.onExpand,
            beforecollapse: me.onBeforeCollapse,
            collapse: me.onCollapse,
            write: me.onStoreWrite,
            datachanged: me.onStoreDataChanged,
            scope: me
        });

        if (me.node && !me.store.node) {
            me.setRootNode(me.node);
        }
        // EOF MODIFICATIONS

        me.animQueue = {};
        me.animWraps = {};
        me.addEvents(
            /**
            * @event afteritemexpand
            * Fires after an item has been visually expanded and is visible in the tree. 
            * @param {Ext.data.NodeInterface} node         The node that was expanded
            * @param {Number} index                        The index of the node
            * @param {HTMLElement} item                    The HTML element for the node that was expanded
            */
            'afteritemexpand',
            /**
            * @event afteritemcollapse
            * Fires after an item has been visually collapsed and is no longer visible in the tree. 
            * @param {Ext.data.NodeInterface} node         The node that was collapsed
            * @param {Number} index                        The index of the node
            * @param {HTMLElement} item                    The HTML element for the node that was collapsed
            */
            'afteritemcollapse'
        );
        me.callParent(arguments);
        me.on({
            element: 'el',
            scope: me,
            delegate: me.expanderSelector,
            mouseover: me.onExpanderMouseOver,
            mouseout: me.onExpanderMouseOut
        });
        me.on({
            element: 'el',
            scope: me,
            delegate: me.checkboxSelector,
            click: me.onCheckboxChange
        });
    }
});