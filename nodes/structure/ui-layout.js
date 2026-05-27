"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_layout(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-layout");
};
