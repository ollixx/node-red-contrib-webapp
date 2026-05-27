"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_store(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-store");
};
