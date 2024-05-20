var device = null;
var inited = false;

var powerSuppliesData = {};
var powerSupplyNamesByType = {};

var updateIntervalMs = 1000; // интервал обновления данных (мс)
var chargingStateSetTime = null; // метка времени

function createControlOrSetValue(name, desc, initial) {
  if (!device.isControlExists(name)) {
    var options = Object(desc);

    options.value = initial;
    device.addControl(name, options);
  }

  device.getControl(name).setValue({value: initial});
}

function collectDataFromPowerSupply(name) {
  if (!name) return;

  runShellCommand('udevadm info --query=property /sys/class/power_supply/{}'.format(name), {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      var dataMap = {};

      capturedOutput.split('\n').forEach(function (line) {
        var parsed = line.match(/^POWER_SUPPLY_(.*)=(.*)$/);

        if (parsed) {
          var param = parsed[1];
          var value = parsed[2];

          dataMap[param] = value;
        }
      });

      powerSuppliesData[name] = dataMap;

      if (dataMap['TYPE']) {
        if (dataMap['PRESENT'] != '0') {
          // do not overwrite if one power supply of this type is already found
          if (!powerSupplyNamesByType.hasOwnProperty(dataMap['TYPE'])) {
            powerSupplyNamesByType[dataMap['TYPE']] = name;
          }

          if (!inited) {
            setInterval(update, updateIntervalMs);
            inited = true;
          }
        } else if (powerSupplyNamesByType[dataMap['TYPE']] == name) {
          delete powerSupplyNamesByType[dataMap['TYPE']];
        }
      }
    }
  });
}

function collectData() {
  // iterate over power_supply instances
  runShellCommand('ls -1 /sys/class/power_supply/', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      var newPowerSupplyList = capturedOutput.split('\n');

      // query and update information for present power supplies
      newPowerSupplyList.forEach(function (line) {
        collectDataFromPowerSupply(line);
      });

      // remove power supplies which are no longer present
      Object.keys(powerSupplyNamesByType).forEach(function (psType) {
        psName = powerSupplyNamesByType[psType];
  
        if (newPowerSupplyList.indexOf(psName) == -1) {
          delete powerSupplyNamesByType[psType];
        }
      });

      Object.keys(powerSuppliesData).forEach(function (psName) {
        if (newPowerSupplyList.indexOf(psName) == -1) {
          delete powerSuppliesData[psName];
          log.info('power supply {} is no longer present'.format(psName));
        }
      });
    }
  });
}

function publishData() {
  var controls = {
    'CAPACITY': {name: 'Percentage', en: 'Charge left', ru: 'Остаток', type: 'value', scale: 1, order: 1},
    'CURRENT_NOW': {name: 'Current', en: 'Current', ru: 'Потребление', type: 'value', scale: 1000000, order: 2},
    'VOLTAGE_NOW': {name: 'Voltage', en: 'Voltage', ru: 'Напряжение', scale: 1000000, order: 3},
    'POWER_NOW': {name: 'Power', en: '-', ru: '-', type: 'power', scale: 1000000, precision: 2, order: 4},
    'STATUS': {name: 'Charging', en: 'Charging', ru: 'Зарядка', type: 'switch', order: 5}
  };

  var batName = powerSupplyNamesByType['Battery'];

  if (batName) {
    var batData = powerSuppliesData[batName];

    if (!device) device = defineVirtualDevice('battery', {
      title: {en: 'Battery', ru: 'Батарея'},
      cells: {},
    });

    // update values for all controls (or create them)
    Object.keys(controls).forEach(function(key) {
      if (!batData.hasOwnProperty(key)) return;

      var item = controls[key];

      if (key == 'STATUS') {
        if (chargingStateSetTime && new Date() - chargingStateSetTime < 2500) return;
  
        var value = (batData[key] == 'Charging');

        createControlOrSetValue(item.name, {title: {en: item.en, ru: item.ru}, type: item.type, order: item.order, readonly: true}, value);
      } else {
        var value = Number(batData[key]) / item.scale;

        if (item.precision != null) {
          value = Math.round(value * Math.pow(10, item.precision)) / Math.pow(10, item.precision);
        }

        createControlOrSetValue(item.name, {title: {en: item.en, ru: item.ru}, type: item.type, order: item.order}, value);
      }
    });
  } else {
    // remove controls if they are exists
    Object.keys(controls).forEach(function(key) {
      var item = controls[key];

      if (device && device.isControlExists(item.name)) {
        device.removeControl(item.name);
      }
    });
  }

  var mainsName = powerSupplyNamesByType['Mains'];

  if (mainsName) {
    var mainsData = powerSuppliesData[mainsName];

    if (mainsData.hasOwnProperty('ONLINE')) {
      dev.power_status['working on battery'] = (mainsData['ONLINE'] != '1');
    }
  }
}

function update() {
  collectData();
  publishData();
}

// collect data at startup, initiralize the device and polling if power supplies found
setTimeout(collectData, 0);