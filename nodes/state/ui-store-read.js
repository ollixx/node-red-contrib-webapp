"use strict";
const registerWebappNodes = require("../webapp.js");
module.exports = function registerui_store_read(RED) {
    registerWebappNodes.registerNodeType(RED, "ui-store-read");
};
