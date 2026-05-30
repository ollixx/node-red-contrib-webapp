"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerui_toast(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-toast");
};
