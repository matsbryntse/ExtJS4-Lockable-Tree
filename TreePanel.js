Ext.define('FixedTreePanel', {
    extend: 'Ext.tree.Panel',

    // TreePanel does not support locked columns
    onRootChange: function (root) {
        if (!this.lockable) {
            this.callParent(arguments);
        }
    }
});