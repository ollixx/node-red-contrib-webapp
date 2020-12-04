module.exports = function (RED) {
    "use strict";

    var ws = require("ws")
    var serveStatic = require('serve-static');
    var url = require('url');

    // create one central handler for all webapp ws servers
    var webappWsServers = {}
    var httpListener = function (request, socket, head) {
        // Make sure that we only handle WebSocket upgrade requests
        if (request.headers['upgrade'] !== 'websocket') {
            socket.end('HTTP/1.1 400 Bad Request');
            return;
        }

        if (socket.handled) {
            console.log("socket was handled. skip");
            return;
        }

        const pathname = url.parse(request.url).pathname;
        //console.log("check upgrade connection ", pathname, Object.keys(webappWsServers));
        let wss = webappWsServers[pathname];
        if (wss) {
            // console.log("connecting for webapp path", pathname);
            wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request);
            });
            socket.handled = true;
        }

    };
    RED.server.on('upgrade', httpListener);

    function handleIncomingMessage(node, ws, message) {
        // handle incoming ws message from app.
        let wsMessage = JSON.parse(message);
        //console.log("wss got message", wsMessage)
        switch (wsMessage.command) {
            case "webapp.ready":
                // console.log("got webapp.ready", wsMessage.msg);
                // send all nodes for page
                let msg = RED.util.cloneMessage(node.pageModel);
                msg.command = "Init";
                ws.send(JSON.stringify(msg));

                // send notification to nr
                node.send({
                    command: wsMessage.command,
                    _socketid: ws.uid
                });
                break;
            default:
                if (wsMessage.nodeid) {
                    // the message is for a defined node
                    // console.log("clients", node.wss.clients);
                    let targetHandler = node.listenerList[wsMessage.nodeid];
                    if (targetHandler) {
                        wsMessage._socketid = ws.uid
                        // console.log("message ws connection", ws);
                        targetHandler(wsMessage);
                    } else {
                        console.log("cannot pass msg to target node. Could not find a handler for nodeid", nodeid);
                    }
                }
        }
    }

    function createWebsocketServer(node) {
        let wss = new ws.Server({ noServer: true });
        wss.on('connection', function (conn) {
            conn.on('message', function (message) {
                handleIncomingMessage(node, conn, message);
            });
            conn.on('close', function () {
                //console.log("closed ws");
            });
            conn.on('error', (err) => console.log('error:', err));
            conn.myid = new Date()
        });

        //console.log("new wss created");
        return wss;
    }

    function createHttpServerHooks(config) {
        let exApp = RED.httpNode; // node-red express application. We integrate our web app als a "sub app"
        let rootPath = config.path;

        let distPath = join(__dirname, "..", "dist")
        let path = join(rootPath)
        exApp.use(path, serveStatic(distPath));
        //console.log("static: ", path, distPath);
    }

    // define and register the node
    function WebApplicationNode(config) {
        try {
            RED.nodes.createNode(this, config);
            // console.log("create webapp node");
            var node = this;

            var status = function(color, msg) {
                node.status({
                     fill: color,
                     shape: "dot",
                     text:  msg
                 });
             };
             var statusGreen = function(msg) {
                status("green", msg);
             };
             var statusYellow = function(msg) {
                status("yellow", msg);
             };
             var statusRed = function(msg) {
                status("red", msg);
             };
        
             function sendWsMessage(msg) {
                if (msg.hasOwnProperty("_socketid")) {
                    // specific websocket, send only to it
                    let wsClient = null;
                    node.wss.clients.forEach((k, client) => {
                        if (client.uid == msg._socketid) {
                            wsClient = client;
                        }
                    });
                    if (!wsClient) {
                        statusRed("unknown socketid " + msg._socketid);
                    } else {
                        if (wsClient.readyState === ws.OPEN) {
                            wsClient.send(JSON.stringify(msg));
                            statusGreen("send " + msg.command + " command");
                        } else {
                            statusYellow("could not find a client for socketid " + msg._socketid);
        
                        }
                    }
                } else {
                    // no socketid, broadcast to all
                    node.wss.clients.forEach(function each(wsClient) {
                        // if (wsClient.readyState === ws.OPEN) {
                        wsClient.send(JSON.stringify(msg));
                        // }
                    });
                    statusGreen("broadcast " + msg.command + " command");
                }
            }
            node.sendWsMessage = sendWsMessage; // API for child nodes
            
            /* 
            expecting config:
            {
                name: "", // name of the web application
                path: "/webapp" // relative path of the web application's root
            }
            */
            config.wsPath = "/" + config.path + "/__ws";
            node.pageModel = {
                nodeid: node.id,
                type: "GuiRoot",
                name: config.name,
                children: [],
                debug: true
            };

            node.wss = createWebsocketServer(node)
            webappWsServers[config.wsPath] = node.wss // add to the list of connected servers
            //console.log("added wss to list", Object.keys(webappWsServers))
            node.http = createHttpServerHooks(config)

            node.on("input", (msg) => {
                // handle incoming commands
                if (msg.hasOwnProperty("command")) {
                    // only commands are send to webapp
                    if (!msg.hasOwnProperty("nodeid")) {
                        // no nodeid given, so this node is the target for this command
                        msg.nodeid = node.id;
                    }

                    let send = true;

                    if (msg.command == "Init") {
                        // save Init message from gui nodes in the page model
                        if (!msg.nodeid) {
                            throw "Init command must come with a nodeid. Cannot compute."
                        }
                        // transform into pagemodel object
                        let model = RED.util.cloneMessage(msg);
                        delete model._msgid;
                        delete model.command;
                        // store in pagemodel
                        node.pageModel.children = node.pageModel.children.filter((child) => {
                            return child.nodeid != model.nodeid
                        })
                        node.pageModel.children.push(model);
                        node.pageModel.children.sort((a, b) => {
                            return a._pos - b._pos;
                        });

                        // console.log("children of webapp", node.pageModel.children);

                        if (node.initialized) {
                            // Init already sent. Send only this child to clients as "Set" command
                            msg.command = "Set";
                        } else {
                            // Init was NOT send here.
                            send = false; // dont send the message yet, as we wait for the first Init
                        }
                    }

                    if (send) sendWsMessage(msg)

                } else {
                    statusYellow("received message without a command");
                }
            });

            node.on('close', () => {
                // console.log("closing webapp");
                try {
                    // DONT REMOVE LISTENERS! There is just one for all webapp nodes!
                    // RED.server.removeListener("upgrade", httpListener);
                    // RED.server.removeListener("connection", httpListener);
                    // console.log("wss clients: ", Object.keys(node.wss.clients).length);
                    node.wss.clients.forEach(function each(wsClient) {
                        // console.log("closing ws ", wsClient.uid);
                        wsClient.terminate();
                    });
                    node.wss.close();
                    // console.log("remove wss ", config.wsPath)
                    delete webappWsServers[config.wsPath]
                    node.status({});
                } catch (err) {
                    console.error("err closing webapp node", err);
                }
            });

            node.listenerList = {};
            node.registerListener = function (nodeid, handlerFunc) {
                if (typeof(nodeid) !== "string") throw "cannot register listener to webapp. first parameter nodeid must be string" 
                if (typeof(handlerFunc) !== "function") throw "cannot register listener to webapp. second parameter handler must be function" 
                node.listenerList[nodeid] = handlerFunc;
            };

            setTimeout(function () {
                sendWsMessage(node.pageModel)
                node.initialized = true;
                node.send(node.pageModel)
                statusGreen("sent init msg");
            }, 120)


        } catch (err) {
            console.err("error in create webapp node", err)
        }
    }
    RED.nodes.registerType("webapp", WebApplicationNode);

    //from: https://stackoverflow.com/a/28592528/3016654
    function join() {
        var trimRegex = new RegExp('^\\/|\\/$', 'g');
        var paths = Array.prototype.slice.call(arguments);
        return '/' + paths.map(function (e) {
            if (e) { return e.replace(trimRegex, ""); }
        }).filter(function (e) { return e; }).join('/');
    }

    // As __webapp/types.js is loaded via <script> tag, it won't get
    // the auth header attached. So do not use RED.auth.needsPermission here.
    // see: https://github.com/node-red/node-red/blob/c7587960fbfe77a1609e7c3c29705bc1d5918dc3/packages/node_modules/%40node-red/nodes/core/core/58-debug.js#L174
    RED.httpAdmin.get("/__webapp/*",function(req,res) {
        var options = {
            root: __dirname + "/../lib",
            dotfiles: 'deny'
        };
        res.sendFile(req.params[0], options);
    });
}
