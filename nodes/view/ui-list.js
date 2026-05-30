"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_list(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-list");
};
