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
    const commands = require("../lib/commands")(RED);

    // define and register the node
    function GuiNode(config) {
        try {
            RED.nodes.createNode(this, config);
            //console.log("create guinode", config);
            var node = this;

            // copy config properties to this node
            node.guitype = config.guitype;
            node.implicitSetCommand = config.implicitSetCommand;

            /* 
                This callback is passed to the webapp receiving my init message.
                The webapp registers me as a listener and sends messages from the webpage
                to me based on my ID. 
            */
            node.receiveWebappMessage = function(msg) {
                // I basically just pass the webapp msg to the appropriate port
                node.send([null, msg]);
            }

            /*
                This callback is used by an webapp receiving my Init message.
                It then registers me as a listener and calls this method to set me
                up.
            */
            node.register = function(webapp) {
                if (node.webapp) {
                    // sanity check
                    throw "Runtime error in guinode '" + node.ID + "': node is already registered at webapp '" + node.webapp.name + "'"
                }
                node.webapp = webapp // pointer to my webapp

                // handle message cue
                //console.log("handle message stack", node.initialMessageCue)
                while (node.initialMessageCue.length > 0) {
                    let msg = node.initialMessageCue.pop();
                    commands.handle(node, msg, node.webapp);
                };
                node.initialized = true;
                statusGreen("initialized");
                // webapp.sendMessage(node.createInitMsg())
            }

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

            // Setup Properties
            let type = types.find(t => {
                return t.name == node.guitype;
            })
            if (type == undefined) {
                throw "Unknown gui type '" + node.guitype + "'. Not found in types.js"
            }
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

                if (node.initialized) {
                    // console.log("input handle", node.id, msg)
                    commands.handle(node, msg, node.webapp)
                } else {
                    // I am not ready, so save the messages for later
                    node.initialMessageCue.push(msg);
                    // console.log("input collect", node.id, msg)
                }

            });

            node.on('close', function () {
                delete node.webapp;
                node.status({});
            });

            node.status({});

            let initialize = function () {
                // send Init Message to parent
                node.send(node.createInitMsg())
                statusYellow("waiting for webapp");
            }
            // start waiting for initialization
            setTimeout(initialize, 10);

        } catch (err) {
            console.log("error in create gui node", err, node)
            throw err
        }
    }
    RED.nodes.registerType("guinode", GuiNode);

}