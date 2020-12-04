
let NodeRedService = function (url) {
  let rws = new ReconnectingWebSocket(url, [], {
    connectionTimeout: 1000
  });
  rws.addEventListener("open", (event) => {
    console.log("ws opened");
    rws.send(JSON.stringify({ command: "webapp.ready", msg: {} }));
  });
  rws.addEventListener("close", (code, reason) => {
    console.log("ws closed", code, reason);
  });
  rws.addEventListener("error", (event) => {
    console.log("error", event);
  });

  let instance = {
    listeners: [],
    rws,
    register: function (handler) {
      this.listeners.forEach((element) => {
        if (element === handler) {
          console.error("handler is already registered. ignoring.");
          return;
        }
      });
      this.listeners.push(handler);
      // console.log("new listener. now got ", this.listeners.length);
    },
    send: function (msg) {
      if (typeof msg === "object") {
        msg = JSON.stringify(msg);
      }
      rws.send(msg);
    }
  };
  rws.addEventListener("message", function (event) {
    try {
      let json = JSON.parse(event.data);
      instance.listeners.forEach((handler) => {
        try {
          handler(json);
        } catch (err) {
          console.error("node-red service: error in handler", err, event.data);
        }
      });
    } catch (err) {
      console.error(
        "node-red service: got a non-json message. ignoring it.",
        err,
        event.data
      );
    }
  });

  return instance;
};
