"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_route(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-route");
};
