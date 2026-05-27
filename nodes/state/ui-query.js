"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_query(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-query");
};
