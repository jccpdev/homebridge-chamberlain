const ChamberlainAccessory = require("./chamberlain-accessory");

module.exports = homebridge => {
    homebridge.registerAccessory("chamberlain", "Chamberlain", ChamberlainAccessory);
};
