"use strict";

const registerWebappNodes = require("../webapp.js");

module.exports = function registerNode(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-pagination");
};
