/*
    server side commands
*/

let commands = function (RED) {
    return {
        handle: function (node, msg, webapp) {
            let handle = arguments.callee; // ref myself 
            try {
                let cmdSet = {
                    Init: function (node, msg, webapp) {
                        // we got a child, that needs to initialize.
                        let child = RED.nodes.getNode(msg.nodeid)
                        // Let it be registered at our webapp:
                        if (child.nodeid != webapp.id) {
                            // only, if I am not the webapp Root node
                            webapp.register(child)
                        }
                        msg.command = "Add" // add this child to me
                        handle(node, msg, webapp)
                    }
                    , Add: function (node, msg, webapp) {
                        // add the child to my list
                        // TODO - this can happen multiple times for the same child node, thus creating copies / instances of it here?
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
                        msg = RED.util.cloneMessage(node.model);
                        msg.command = "Set";
                        handle(node, msg, webapp)
                    }
                    , Set: function (node, msg, webapp) {
                        // merge command with model and send
                        delete msg._msgid
                        msg.nodeid = node.id
                        msg = { ...node.model, ...msg }
                        
                        // My props have changed, so I notify the clients
                        webapp.sendWsMessage(msg);
                        // I also need to notify my parent, to update the server side model fo the app
                        msg.command = "Update"
                        node.send(msg); // port 0 -> parent
                    }
                    , Update: function (node, msg, webapp) {
                        // one of my children notifies me, that it has changed
                        node.model.children.forEach((child) => {
                            if (child.nodeid == msg.nodeid) {
                                delete msg._msgid
                                delete msg._socketid
                                Object.assign(child, msg);
                                console.log("updated child", child.nodeid, "in", node.id)
                            }
                        });
                        // notify my parent (send update notificatio up to the webapp model)
                        if (node.id != webapp.id) {
                            // only, if there is a parent (the webapp node hasn't)
                            msg = RED.util.cloneMessage(node.model);
                            msg.command = "Update";
                            node.send(msg);
                        } else {
                            //console.log("webapp up-to-date", webapp.id, webapp.name, "msg", msg)
                            //msg.command = "Set"
                            // webapp.sendWsMessage(msg);
                        }
                    }
                    , Hide: function (node, msg, webapp) {
                        msg = RED.util.cloneMessage(node.model);
                        msg.hide = true
                        webapp.sendWsMessage(msg);
                    }
                    , Show: function (node, msg, webapp) {
                        msg = RED.util.cloneMessage(node.model);
                        msg.hide = false
                        webapp.sendWsMessage(msg);
                    }
                };

                // implicit Set command
                if (!msg.command) msg.command = "Set"
                console.log(node.id, "command", msg.command, msg.nodeid)
                let cmd = cmdSet[msg.command]
                if (cmd == undefined) {
                    throw "Unknown command '" + msg.command + "'"
                }
                cmd.bind(this)(node, msg, webapp)
            } catch (err) {
                console.error("error in command handler", err)
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = commands;
}