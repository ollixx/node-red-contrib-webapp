
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
    updateRouting(state, model) {

        function collectRoutes(state, collectedRoutes, model, parentPageModel) {
            /*
            Extract all pages from the model and add appropriate routes to the app
            To identify the correct path, we need to track the page hierarchy to reflect page nesting
            */
            // console.log("find pages", model.type, model.name || model.nodeid, parentPageModel ? "parent: " + parentPageModel.name : "")
            if (model.type == "GuiPage") {
                let route = {
                    name: model.nodeid,
                    component: GuiPage,
                    props: route => {
                        // to get the latest state, we need to retrieve the model for this page from the store
                        let mod = state.index[model.nodeid]
                        // console.log("-- model", model.nodeid, mod)
                        return {
                            model: mod,
                            payload: {}
                        }
                    },
                    children: []
                };
                if (parentPageModel) {
                    if (!parentPageModel.nodeid) throw "parentModel has no nodeid - invalid state"

                    let parentRoute = collectedRoutes[parentPageModel.nodeid]

                    route.path = model.name
                    parentRoute.children = parentRoute.children || []
                    parentRoute.children.push(route)

                    if (model.defaultPage) {
                        route.alias = [""]
                    }
                    //console.log("add nested route", route)
                    collectedRoutes[parentRoute.name] = parentRoute
                } else {
                    route.path = "/" + model.name
                    if (model.defaultPage) {
                        route.alias = ["/"]
                    }
                    // console.log("add top level route", route)
                    collectedRoutes[route.name] = route
                }
                // console.log("new routes", collectRoutes)
            }
            if (model.hasOwnProperty("children")) {
                for (let child of model.children) {
                    collectRoutes(state, collectedRoutes, child, model.type == "GuiPage" ? model : parentPageModel)
                }
            }
        }

        // TODO: DIese Funktion wird ggf. mit einem child model aufgerufen!!!!
        // also alle model elemente noch mal durchnudeln, d.h. alles von vorne.
        // Also model brauchen wir hier gar nicht, das muss immer vom root aus gemacht werden,
        // damit alle routen neu und korrekt sind.

        // collect all routes and add them when final.
        let routes = {}
        // collectRoutes(state, routes, model) // update for given mode only (wont work for nested stuff)
        collectRoutes(state, routes, state.model) // update the complete model
        // reset router
        // -> work around top rest routes: kudos to https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
        router.matcher = new VueRouter({ routes: [] }).matcher
        Object.values(routes).forEach(route => {
            // console.log("add route", route)
            router.addRoute(route)
        })

        // console.log("final routes", router.getRoutes())

        // finally find currentRoute in router, 
        // or replace it with root if we are on a page, that does no longer exist
        let found = router.getRoutes().find(route => {
            return route.path == router.currentRoute.path
        })
        if (!found) {
            router.replace("/")
            // Idea: we could add a notification message to the model to show, 
            // that we had to navigate away from a removed path...
            // That needs a central message stack and notification Component
        }
    },
}

const store = new Vuex.Store({
    state: {
        index: {}, // lookup map (nodeid -> node)
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
                console.log("routes pre", router.getRoutes())
                nodeHelper.updateRouting(state, node)
            } catch (err) {
                console.trace("error in Root command", err)
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
                if (parent.type == "GuiPage") {
                    console.log("routes pre", router.getRoutes())
                    nodeHelper.updateRouting(state, parent)
                }
            } catch (err) {
                console.error("error in Add command", err)
            }
        },
        set(state, props) {
            // replace all properties in node with matching values from props
            try {
                let nodeid = props.nodeid
                let model = state.index[nodeid]
                for (let key in props) {
                    Vue.set(model, key, props[key])
                }
                nodeHelper.updateIndex(state, model)
                if (model.type == "GuiPage") {
                    console.log("routes pre", router.getRoutes())
                    nodeHelper.updateRouting(state, model)
                }
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
            let path = router.getRoutes().find(route => {
                return route.name == msg.nodeid
            }).path
            console.log("navigate to path", path)
            // router.push({ name: msg.nodeid })
            router.push(path)
        },
        togglemenu(state, msg) {
            try {
                let nodeid = msg.nodeid
                let model = state.index[nodeid]
                Vue.set(model, "menuVisible", !model.menuVisible);
            } catch (err) {
                console.error("error in unexpand command", err)
            }
        }
    }
})