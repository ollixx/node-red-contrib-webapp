"use strict";
const registerWebappNodes = require("../webapp.js");
module.exports = function registerui_query_action(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-query-action");
};
