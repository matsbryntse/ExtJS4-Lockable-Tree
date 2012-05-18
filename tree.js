Ext.onReady(function () {
    //we want to setup a model and store instead of using dataUrl
    Ext.define('Task', {
        extend: 'TreeNode',
        fields: [
            { name: 'name', type: 'string' },
            { name: 'duration', type: 'string' }
        ]
    });

    var store = Ext.create('FixedTreeStore', {
        buffered: true,
        model: 'Task',
        isFillingRoot: false,
        proxy: {
            type: 'memory'
        }
    });

    function generateTaskData() {
        var arr = [],
            i, j, k,
            cn, cn2;

        for (var i = 1; i < 10; i++) {
            cn = [];
            for (j = 1; j < 10; j++) {
                cn2 = [];
                for (k = 1; k < 10; k++) {
                    cn2.push({
                        name: 'Child task ' + String(i) + String(j) + String(k),
                        duration : i,
                        leaf: true
                    });
                }
                cn.push({
                    name: 'Child task ' + String(i) + String(j),
                    duration : i,
                    expanded: true,
                    children: cn2
                });
            }
            arr.push({
                name: 'Root task #' + i,
                duration : i,
                children: cn,
                expanded: true
            });
        }

        return arr;
    }

    Ext.create('FixedTreePanel', {
        title: 'Core Team Projects',
        width: 500,
        height: 300,
        renderTo: Ext.getBody(),
        collapsible: true,
        useArrows: true,
        rootVisible: false,
        store: store,
        multiSelect: true,
        singleExpand: true,

        //the 'columns' property is now 'headers'
        columns: [{
            xtype: 'treecolumn', //this is so we know which column will show the tree
            text: 'Task',
            width: 200,
            sortable: true,
            dataIndex: 'name',
            locked: true
        }, {
            text: 'Duration',
            width: 150,
            dataIndex: 'duration',
            sortable: true
        }, {
            text: 'Some unlocked column',
            width: 150,
            dataIndex: 'name',
            sortable: true
        }]
    });

    store.proxy.data = generateTaskData();

    store.load();
});
