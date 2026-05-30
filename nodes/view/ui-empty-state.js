"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_empty_state(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-empty-state");
};
