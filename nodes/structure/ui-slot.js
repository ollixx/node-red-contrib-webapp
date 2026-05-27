"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_slot(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-slot");
};
