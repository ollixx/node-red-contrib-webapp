"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_checkbox(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-checkbox");
};
