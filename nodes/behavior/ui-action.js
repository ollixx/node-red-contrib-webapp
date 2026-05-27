"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_action(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-action");
};
