"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_dialog(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-dialog");
};
