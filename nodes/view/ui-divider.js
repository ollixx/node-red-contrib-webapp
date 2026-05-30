"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_divider(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-divider");
};
