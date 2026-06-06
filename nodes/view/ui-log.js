"use strict";
const registerWebappNodes = require("../webapp.js");
module.exports = function registerui_log(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-log");
};
