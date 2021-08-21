
// setup vuex store
const nodeHelper = {
    updateIndex(state, model) {
        state.index[model.nodeid] = model
        if (model.hasOwnProperty("children")) {
            for (let child of model.children) {
                this.updateIndex(state, child)
            }
        }
    },
    handlePageNodes(state, model, parentPageModel) {
        /*
            Extract all pages from the model and add appropriate routes to the app
            To identify the correct path, we need to track the page hierarchy to reflect page nesting
        */
        if (model.type == "GuiPage") {
            var parentPath = ""
            if (parentPageModel) {
                if (!parentPageModel.nodeid) throw "parentModel has no nodeid - invalid state"
                let parentRoute = router.getRoutes().find((route) => {
                    return route.name == parentPageModel.nodeid
                })
                parentPath = parentRoute.path
            }
            let routeName = model.name || model.nodeid
            let route = {
                name: routeName,
                path: model.defaultPage ? "/" : parentPath + "/" + routeName,
                component: GuiPage,
                props: {
                    model,
                    payload: {}
                }
            };
            route = {
                name: routeName,
                path: parentPath + "/" + routeName,
                alias: model.defaultPage ? "/" : undefined,
                component: GuiPage,
                props: {
                    model,
                    payload: {}
                }
            };
            if (parentPageModel) {
                // add nested route to parent
                router.addRoute(parentPageModel.nodeid, route)
            } else {
                // add new top level route
                router.addRoute(route)
            }
        }
        if (model.hasOwnProperty("children")) {
            for (let child of model.children) {
                this.handlePageNodes(state, child, model.type == "GuiPage" ? model : undefined)
            }
        }
    },
}

const store = new Vuex.Store({
    state: {
        index: {}, // lookup map (nodeid -> node)
        routes: [], // 
        model: {
            name: "waiting for server..."
        }, // the GUI model, hierarchical
    },
    mutations: {
        root(state, node) {
            // replace the complete gui model with the given node
            //console.log("mut Root", state)
            try {
                state.model = node
                state.index = {} // reset index, since all old nodes are stale
                nodeHelper.updateIndex(state, node)
                nodeHelper.handlePageNodes(state, node)
            } catch (err) {
                console.error("error in Root command", err)
            }
        },
        add(state, nodeid, node) {
            // add the givren node to the node with nodeid as a child
            try {
                let parent = state.index[nodeid]
                parent.children = parent.children || []
                parent.children.push(node)
                nodeHelper.updateIndex(state, node)
                // sort children by _pos, i.e. roughly their position in the NR editor
                parent.children.sort((a, b) => {
                    return a._pos - b._pos;
                });
                nodeHelper.handlePageNodes(state, parent)
            } catch (err) {
                console.error("error in Add command", err)
            }
        },
        set(state, props) {
            // replace all properties in node with matching values from props
            try {
                let nodeid = props.nodeid
                let parent = state.index[nodeid]
                for (let key in props) {
                    Vue.set(parent, key, props[key])
                }
                nodeHelper.updateIndex(state, parent)
                nodeHelper.handlePageNodes(state, parent)
            } catch (err) {
                console.error("error in Set command", err)
            }
        },
        hide(state, msg) {
            // make node hidden
            try {
                let nodeid = msg.nodeid
                let node = state.index[nodeid]
                // console.log("before mut Hide", JSON.stringify(node))
                Vue.set(node, 'hide', true)
                // console.log("after mut Hide", node)
            } catch (err) {
                console.error("error in hide command", err)
            }
        },
        show(state, msg) {
            // make node unhidden
            try {
                let nodeid = msg.nodeid
                let node = state.index[nodeid]
                Vue.set(node, 'hide', false)
                // console.log("after mut Show", node)
            } catch (err) {
                console.error("error in show command", err)
            }
        },
        payload(state, msg) {
            // send payload to server
            try {
                let nodeid = msg.nodeid
                let node = state.index[nodeid]
                let retMsg = {
                    nodeid: nodeid,
                    command: "Payload",
                    payload: node.payload
                }
                Vue.send(retMsg)
            } catch (err) {
                console.error("error in payload command", err)
            }
        },
        navigate(state, msg) {
            if (!msg.page) {
                throw "cannot navigate without a page name"
            }
            router.push({name: msg.page})
        }
    }
})