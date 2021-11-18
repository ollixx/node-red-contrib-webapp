/*
    server side commands
*/
const deepEqual = function (a, b) {
    let tA = typeof (a)
    let tB = typeof (b)
    if (a === null) {
        if (b === null) {
            return true;
        } else {
            return false;
        }
    }
    if (a === undefined) {
        if (b === undefined) {
            return true;
        } else {
            return false;
        }
    }
    if (Array.isArray(a)) {
        if (Array.isArray(b)) {
            if (a.length == b.length) {
                for (const i in a) {
                    if (!deepEqual(a[i], b[i])) {
                        return false
                    }
                }
                return true;
            }
        }
        return false;
    }
    if (tA && tA == "object") {
        if (Array.isArray(b)) {
            return false;
        }
        if (tB && tB == "object") {
            if (Object.keys(a).length == Object.keys(a).length) {
                for (const k in a) {
                    if (!deepEqual(a[k], b[k])) {
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }
    return a === b;
}

/*
try {
    console.log("boolean", deepEqual(true, true), deepEqual(false, false), deepEqual(true, false));
    console.log("number", deepEqual(1.0, 1.0), deepEqual(1.0, 1), deepEqual(1.01, 1.02));
    console.log("string", deepEqual("", ""), deepEqual(" ", " "), deepEqual("a", "b"));
    console.log("array", deepEqual([], []), deepEqual([1, 2, 3], [1, 2, 3]), deepEqual([1, 2, 3], [1, 2, 4]), deepEqual([1, 2, 3], [1, 3, 2]));
    console.log("obj", deepEqual({}, {}), deepEqual({ a: 1, b: "23" }, { b: "23", a: 1 }), deepEqual({ a: 2, b: 3 }, { a: 2, b: 3.01 }));
    console.log("null", deepEqual(null, null), deepEqual(null, undefined), deepEqual(null, false));
    console.log("complex", deepEqual({ a: {}, b: [], c: { a: 42 } }, { c: { a: 42 }, b: [], a: [] }));
} catch (err) {
    console.trace(err);
}
//*/

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

                        let model = { ...{}, ...node.model }
                        if (msg.model) {
                            // only use the msg.model object to set props
                            model = { ...model, ...msg.model }
                            delete msg.model;
                        } else {
                            // use the whole msg, but filter for known props
                            for (const prop in node.model) {
                                if (!deepEqual(msg[prop], node.model[prop])) {
                                    let old = node.model[prop];
                                    model[prop] = msg[prop];
                                }
                            }
                        }
                        if (msg._socketid === undefined) {
                            // merge command with model, only if for all clients!
                            node.model = model
                        }

                        let newMsg = model;
                        newMsg._msgid = msg._msgid;
                        if (msg._socketid) {
                            // make sure we handle broadcasts correctly 
                            newMsg._socketid = msg._socketid;
                        }
                        newMsg.command = msg.command;
                        newMsg.nodeid = node.id // I am the target of the SET command
                        msg = newMsg;

                        // My props have changed, so I notify the client(s)
                        webapp.sendWsMessage(msg);

                        if (msg._socketid === undefined) {
                            // I also need to notify my parent, to update the server side model fo the app
                            msg.command = "Update"
                            node.send(msg); // port 0 -> parent
                        }
                    }
                    , Update: function (node, msg, webapp) {
                        // one of my children notifies me, that it has changed
                        node.model.children.forEach((child) => {
                            if (child.nodeid == msg.nodeid) {
                                delete msg._msgid
                                delete msg._socketid
                                Object.assign(child, msg);
                                // console.log("updated child", child.nodeid, "in", node.id)
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
                        let m = {}
                        m.nodeid = node.id
                        m._msgid = msg._msgid
                        m._socketid = msg._socketid
                        m.command = "hide"
                        webapp.sendWsMessage(m);
                    }
                    , Show: function (node, msg, webapp) {
                        let m = {}
                        m.nodeid = node.id
                        m._msgid = msg._msgid
                        m._socketid = msg._socketid
                        m.command = "show"
                        webapp.sendWsMessage(m);
                    }
                    , Payload: function (node, msg, webapp) {
                        let m = {}
                        m.nodeid = node.id
                        m._msgid = msg._msgid
                        m._socketid = msg._socketid
                        m.command = "payload"
                        webapp.sendWsMessage(m);
                    }
                    , Navigate: function (node, msg, webapp) {
                        msg.nodeid = node.id
                        if (node.guitype == "GuiPage") {
                            msg.page = msg.page || node.name
                        }
                        webapp.sendWsMessage(msg);
                        // pass thru
                        node.send([null, msg]);
                    }
                    , Unexpand: function (node, msg, webapp) {
                        let m = {}
                        m.nodeid = node.id
                        m._msgid = msg._msgid
                        m._socketid = msg._socketid
                        m.command = "toggleMenu"
                        webapp.sendWsMessage(m);
                    }
                };

                // implicit Set command
                if (!msg.command) msg.command = "Set"
                // console.log(node.id, "command", msg.command, msg.nodeid)
                let cmd = cmdSet[msg.command]
                if (cmd == undefined) {
                    throw new Error("Unknown command '" + msg.command + "'");
                }
                cmd.bind(this)(node, msg, webapp)
            } catch (err) {
                console.trace("error in command handler", err)
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = commands;
}