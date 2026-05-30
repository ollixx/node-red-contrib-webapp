"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_select(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-select");
};
