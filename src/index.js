const ChamberlainAccessory = require('./chamberlain-accessory');
const instance = require('./instance');

module.exports = homebridge => {
  instance.homebridge = homebridge;

  homebridge.registerAccessory(
    'chamberlain',
    'Chamberlain',
    ChamberlainAccessory
  );
};
