var WebsocketPlugin = {
    debug: false
};
WebsocketPlugin.install = function (Vue, options) {
    
    // 1. add global method or property
    Vue.rws = new ReconnectingWebSocket(
        ((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + window.location.pathname + "__ws",
        [],
        {
            connectionTimeout: 1000
        }
    );
    Vue.rws.addEventListener('open', (event) => {
        console.log("ws opened")
        Vue.rws.send(JSON.stringify({command: "webapp.ready", msg: {}}));
    });
    Vue.rws.addEventListener('close', (code, reason) => {
        console.log("ws closed", code, reason)
    });
    Vue.rws.addEventListener('error', (event) => {
        console.log('error', event);
    });
    Vue.rws.addEventListener('message', (event) => {
        if (this.debug) console.log('message', event.data);
    });
}
