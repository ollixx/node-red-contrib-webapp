var NodePlugin = {
    debug: true
};
NodePlugin.install = function (Vue, options) {

    let rws = Vue.rws;
    Vue.node = {
        rws,
        registry: {},
        register: function (id, handler) {
            this.registry[id] = handler;
            console.log("node registry got new listener " + id);
        },
        emit: function (msg) {
            // we got a message from backend or a vue component
            console.log("node handler got", msg)
            let nodeid = msg.nodeid;
            let cmd = msg.command;
            if (nodeid) {
                let handler = Vue.node.registry[nodeid];
                if (handler) {
                    console.log("  message for " + nodeid + ": command", cmd)
                    handler(msg); // call handler
                } else {
                    console.log("  no node found for id " + nodeid)
                }
            } else {
                console.log("  nodehandler: got message without nodeid", msg);
            }
        }
    }
    Vue.rws.addEventListener('message', (event) => {
        // here we got a message from the backend
        let msg = JSON.parse(event.data);
        if (msg.command == "Init" && msg.type == "root") {
            // register nodeid of (new) root node
            Vue.node.register(msg.nodeid, Vue.node.registry["root"]);
        }
        Vue.node.emit(msg)
    });
    if (this.debug) console.log("NodePlugin installed");

}
