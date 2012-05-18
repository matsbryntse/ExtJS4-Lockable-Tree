Ext.define('TreeNode', {
    extend: 'Ext.data.Model',

    constructor : function() {
        this.getModifiedFieldNames = function () {
            if (this.__isFilling__) return [];
            
            delete this.getModifiedFieldNames;
            
            return this.getModifiedFieldNames();
        };

        this.callParent(arguments);
    }
});

