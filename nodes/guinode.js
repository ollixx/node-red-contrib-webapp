const webapp = require("./webapp");

const winston = require("winston");
winston.remove(winston.transports.Console);
const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.Console(),
    ],
    format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
    ),
});


module.exports = function (RED) {
    "use strict";

    const types = require("../lib/types");

    // define and register the node
    function GuiNode(config) {
        try {
            RED.nodes.createNode(this, config);
            //console.log("create guinode", config);
            var node = this;
            // get the referenced webapp node
            if (config.appname) {
                node.webapp = RED.nodes.getNode(config.appname);
                node.webapp.registerListener(node.id, function (msg) {
                    // expose incoming message to second port
                    //console.log("gui-node got msg", msg);
                    node.send([null, msg]);
                });
                node.wss = node.webapp.wss;
            }
            node.guitype = config.guitype;
            node.implicitSetCommand = config.implicitSetCommand;

            // Collect the Init Messages from my children. I wait with my Init Message until all are collected
            // key: nodeid, value: {node, InitCommand}
            node.initialChildCue = false;
            // cue incoming message at startup until I am initialized
            node.initialMessageCue = [];
            // When I have sent my Init Message, I am done and initialized=true 
            node.initialized = false;

            // this node's gui model
            node.model = {
                type: node.guitype,
                nodeid: node.id,
                slot: config.parentslot,
                children: [],
                _pos: (config.y + parseFloat("0." + config.x)), // sorting based on relative node position x,y (global for all tabs)
            }
            if (node.guitype) {
                // add props for the current type
                let type = types.find(t => {
                    return t.name == node.guitype;
                })
                if (type.props) {
                    type.props.forEach(prop => {
                        if (prop.type == "typedinput") {
                            let value = config.props[prop.name];
                            let type = config.props["$" + prop.name];
                            if (["mod", "par", "pay"].indexOf(type) == -1) {
                                node.model[prop.name] = RED.util.evaluateNodeProperty(value, type, node, {});
                            } else {
                                node.model[prop.name] = value;
                                node.model["$" + prop.name] = type;
                            }
                        } else {
                            node.model[prop.name] = config.props[prop.name];
                        }
                    });
                }
            }

            node.createInitMsg = function () {
                let msg = RED.util.cloneMessage(node.model);
                msg.command = "Init";
                return msg;
            }

            var status = function (color, msg) {
                node.status({
                    fill: color,
                    shape: "dot",
                    text: msg
                });
            };
            var statusGreen = function (msg) {
                status("green", msg);
            };
            var statusYellow = function (msg) {
                status("yellow", msg);
            };
            var statusRed = function (msg) {
                status("red", msg);
            };

            let readWiredChildren = function () {
                if (node.initialChildCue == false) {
                    node.initialChildCue = {};
                    RED.nodes.eachNode((child) => {
                        if (child.wires && child.wires.length > 0) {
                            child.wires[0].forEach((nodeid) => {
                                if (nodeid == node.id && child.type == "guinode") {
                                    node.initialChildCue[child.id] = { node: child };
                                }
                            })
                        }
                    });
                }
            }

            let handleNonInitMessage = function (msg) {
                switch (msg.command) {
                    case "Set": {
                        // replace properties from message
                        let type = types.find(t => {
                            return t.name == node.guitype;
                        })
                        if (type.props) {
                            type.props.forEach(prop => {
                                if (msg[prop.name] != undefined) {
                                    node.model[prop.name] = msg[prop.name];
                                }
                            });
                        }
                        if (msg.hasOwnProperty("hide")) {
                            node.model.hide = msg.hide;
                        }
                        msg = RED.util.cloneMessage(node.model);
                        msg.command = "Set";
                        break;
                    }
                    case "Add": {
                        let child = RED.util.cloneMessage(msg)
                        delete child.command
                        delete child._msgid
                        // set ID, if necessary
                        if (!child.hasOwnProperty("nodeid")) {
                            // no nodeid given, so this node is the target for this command
                            let index = node.model.children.length;
                            // if index exists in children, increase until we got a new one
                            while (node.model.children.find(ch => { ch.nodeid.endsWith("." + index) })) { index++ };
                            msg.nodeid = node.id + "." + index;
                        }
                        node.model.children.push(child);
                        node.model.children.sort((a, b) => {
                            return a._pos - b._pos;
                        });
                        msg = RED.util.cloneMessage(node.model);
                        msg.command = "Add";
                        break;
                    }
                }

                if (!msg.hasOwnProperty("nodeid")) {
                    // no nodeid given, so this node is the target for this command
                    msg.nodeid = node.id
                }

                //console.log(node.id, "send message to ws", msg);
                node.webapp.sendWsMessage(msg);
            };

            node.on("input", function (msg) {

                // console.log(node.id, "got message", msg);

                // handle incoming commands
                if (msg.hasOwnProperty("command") || node.implicitSetCommand) {

                    // implicit Set command
                    if (!msg.command) msg.command = "Set";

                    // handle init event from child
                    if (msg.command == "Init") {
                        if (!msg.nodeid) {
                            throw "cannot handle Init command from a non gui-node node"
                        }
                        if (node.initialized) {
                            throw "GuiNode got an Init Message from a child, but is already initialized. That should never happen!"
                        }

                        // find nodes, that are wired to me, thus are children and keep the list
                        readWiredChildren();

                        let childData = node.initialChildCue[msg.nodeid];
                        if (!childData) {
                            throw "Got an Init Message from an unknown child. That should never happen"
                        }
                        if (childData.initMessage) {
                            throw "Got a second Init Message from a child. That should never happen"
                        }

                        childData.initMessage = msg;
                        // console.log(node.id, " got message.", node.initialChildCue)

                        // Keep child in my children
                        let childModel = RED.util.cloneMessage(msg)
                        delete childModel.command
                        delete childModel._msgid
                        // delete old version of the same child node by id
                        for (let index = 0; index < node.model.children.length; index++) {
                            const element = node.model.children[index];
                            if (element.nodeid == childModel.nodeid) {
                                node.model.children.splice(index, 1);
                            }
                        }
                        node.model.children.push(childModel);
                        node.model.children.sort((a, b) => {
                            return a._pos - b._pos;
                        });

                        return
                    }

                    // here we have a non-init command
                    if (!node.initialized) {
                        // we are not initialized, so we cue any message, that comes too early
                        node.initialMessageCue.push(msg);
                        return // stop processing and wait for initialization
                    }

                    handleNonInitMessage(msg)

                } else {
                    statusYellow("received message without a command");
                }
            });

            node.on('close', function () {
                delete node.wss;
                delete node.webapp;
                node.status({});
            });

            node.status({});

            let initialize = function () {
                // are we ready to send? All children should have sent an Init Message
                readWiredChildren();

                let canInit = true;
                for (let cd in node.initialChildCue) {
                    let childData = node.initialChildCue[cd];
                    if (canInit) {
                        // check only, if not already found an empty child data entry (not yet received msg from it)
                        if (!childData.initMessage) {
                            setTimeout(initialize, 100);
                            //console.log(node.id, "have not got all children's messages. continue to wait for ", childData.node.id);
                            canInit = false;
                        }
                    }
                };

                if (canInit) {
                    // we got Init Messages from all wired children here

                    // send Init Message to parent
                    node.send(node.createInitMsg())
                    node.initialized = true;

                    // TODO: Here we may need to wait until the Init Process is completely done!!!

                    // send any cued messages to the client(s)
                    node.initialMessageCue.forEach((message) => {
                        handleNonInitMessage(message);
                    });
                    //console.log("initialized");
                    statusGreen("sent init msg");
                }
            }
            // start waiting for initialization
            setTimeout(initialize, 100);

        } catch (err) {
            console.log("error in create gui node", err)
        }
    }
    RED.nodes.registerType("guinode", GuiNode);

}