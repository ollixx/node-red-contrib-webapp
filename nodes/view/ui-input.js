"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_input(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-input");
};
