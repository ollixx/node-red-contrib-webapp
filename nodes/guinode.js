const webapp = require("./webapp");

module.exports = function (RED) {
    "use strict";

    var winston = require("winston");
    winston.remove(winston.transports.Console);
    const logger = winston.createLogger({
        level: "debug",
        transports: [
          new winston.transports.Console(),
        ],
        format: winston.format.combine(
            winston.format.splat(),
            winston.format.simple()
        ),
      });

    const types = require("../lib/types");

    // define and register the node
    function GuiNode(config) {
        try {
            RED.nodes.createNode(this, config);
            //console.log("create guinode", config);
            var node = this;
            // get the referenced webapp node
            node.webapp = RED.nodes.getNode(config.appname);
            node.webapp.registerListener(node.id, function (msg) {
                // expose incoming message to second port
                console.log("gui-node got msg", msg);
                node.send([null, msg]);
            });
            node.wss = node.webapp.wss;
            node.guitype = config.guitype;
            node.initialized = false;

            console.log("props", config.props);

            // this nodes gui model
            node.model = {
                type: node.guitype,
                nodeid: node.id,
                slot: config.parentslot,
                children: [],
                _pos: (config.y + parseFloat("0." + config.x)), // sorting based on relative node position x,y (global for all tabs)
            }
            // add props for the current type
            let type = types.find(t => {
                return t.name == node.guitype;
            })
            if (type.props) {
                type.props.forEach(prop => {
                    if (prop.type == "typedinput") {
                        node.model[prop.name] = RED.util.evaluateNodeProperty(config.props[prop.name], config.props[prop.name + "-type"], node, {}); 
                        console.log("typeinput:", config.props[prop.name], config.props[prop.name + "-type"], node.model[prop.name]);
                    } else {
                        node.model[prop.name] = config.props[prop.name];
                    }
                });
            }
            // console.log("initial model", node.model);

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

            node.on("input", function (msg) {

                // handle incoming commands
                if (msg.hasOwnProperty("command")) {

                    // handle init event from child
                    if (msg.command == "Init") {
                        if (msg.nodeid) {

                            // Keep child in my children
                            let child = RED.util.cloneMessage(msg)
                            delete child.command
                            delete child._msgid
                            node.model.children.push(child);
                            node.model.children.sort((a, b) => {
                                return a._pos - b._pos;
                            });
              
                            if (node.initialized) {
                                // This node has already sent Init to parent, so we have to inform our parent of the change
                                // the final model is save also in the root node, i.e. webapp node
                                node.send(node.createInitMsg())
                                logger.debug("%s - got Init from child. Send again to parent", node.id)
                            } else {
                                // This node is not yet initialized, so we store any faster children
                                logger.debug("got Init from child. store until my Init")
                            }
                        } else {
                            throw "cannot handle Init command from a non gui-node node"
                        }
                        return
                    }

                    // only commands are send to webapp
                    if (!msg.hasOwnProperty("nodeid")) {
                        // no nodeid given, so this node is the target for this command
                        msg.nodeid = node.id
                    } else {
                        msg.parentNodeid = node.id
                    }

                    node.webapp.sendWsMessage(msg);
                } else {
                    statusYellow("received message without a command");
                }
            });

            node.on('close', function () {
                delete node.wss;
                delete node.webapp;
                node.status({});
            });

            setTimeout(function () {
                node.send(node.createInitMsg())
                node.initialized = true;
                statusGreen("sent init msg");
            }, 100)

        } catch (err) {
            console.log("error in create gui node", err)
        }
    }
    RED.nodes.registerType("guinode", GuiNode);

}