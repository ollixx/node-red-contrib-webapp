"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_tabs(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-tabs");
};
