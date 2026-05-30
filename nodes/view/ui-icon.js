"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_icon(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-icon");
};
