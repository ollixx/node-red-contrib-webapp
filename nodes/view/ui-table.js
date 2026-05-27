"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_table(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-table");
};
