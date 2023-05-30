/**
 * Creates Thermal control device.
 * 
 * @typedef {Object} CellObject - Description of the control in the virtual device
 * @property {string} title - The title of the cell.
 * @property {string} type - The type of the cell. You can find types list in wb-rules documentation.
 * @property {string|number} value - The current value of the cell.
 * @property {boolean} readonly - A flag indicating whether the cell is readonly.
 * @property {number} order - The order of the cell in virtual device.
 * @property {string} [units] - The units of the cell's value. This is optional and only valid when type is "value".
 *
 * @typedef {Object} ThermalControlDevice
 * @property {CellObject} devEnabled - Represents the enable/disable status of the device.
 * @property {CellObject} devState - Represents the current state of the device. Value can be one of: "DISABLED", "IDLE", "COOLING", or "HEATING".
 * @property {CellObject} temperature - Represents the current temperature of the device.
 * @property {CellObject} setpoint - Represents the setpoint temperature of the device.
 * @property {CellObject} hysteresis - Represents the current hysteresis of the device.
 */

function _defineThermalControlDevice(config, setpointDefault) {
  return defineVirtualDevice(config.devName, {
    title: config.devTitle,
    cells: {
      devEnabled: {
        title: "Enable",
        type: "switch",
        value: 1,
        readonly: false,
        order: 1,
      },
      devState: {
        title: "State",
        type: "text",
        readonly: true,
        value: "DISABLED",
        order: 10,
      },
      temperature: {
        title: "Temperature",
        type: "value",
        units: "°C",
        readonly: true,
        value: 0,
        order: 20,
      },
      setpoint: {
        title: "Setpoint",
        type: "value",
        units: "°C",
        readonly: false,
        value: setpointDefault,
        order: 30,
      },
      hysteresis: {
        title: "Hysteresis",
        type: "value",
        units: "°C",
        readonly: true,
        value: 0,
        order: 90,
      },
    },
  });
}

/**
 * Creates thermal control virtual device.
 *
 * @constructor
 *
 * @param {Object} config - Configurtaion of this countdown switch.
 * @param {string} config.devName - Name for a virtual device (should be valid MQTT subtopic).
 * @param {string} [config.devTitle] - Title for the timer's virtual device (any Unicode string).
 * @param {string[]} [config.modes] - List of allowed modes. May be "heating" and "cooling".
 * @param {string} config.temperatureSource - Source of temperature, must be valid MQTT subtopic.
 * @param {string} [config.heatingChannel] - Source of switch of real heating device, must be valid MQTT subtopic.
 * @param {string} [config.coolingChannel] - Source of switch of real cooling device, must be valid MQTT subtopic.
 * @param {Object} [config.setpoint] - Range and default value of thermal setpoint.
 * @param {float} [config.hysteresis] - Value of thermal hysteresis.
 * @param {boolean} [config.debug] - Allow logging.
 * @example
 *
 * var libtherm = require("thermalcontrol");
 *
 * config = ({
 *     devName: "climate_kitchen",
 *     devTitle: "Температура на кухне",
 *     modes: ["heating", "cooling"],
 *     temperatureSource: "wb-w1/somesensor",
 *     heatingChannel: "wb-gpio/EXT2_R3A1",
 *     coolingChannel: "wb-gpio/EXT2_R3A2",
 *     setpoint: {
 *         "min": 6,
 *         "max": 35,
 *         "default": 23
 *     },
 *     hysteresis: 1,
 *     debug: false
 * });
 *
 *
 * var climate_in_kitchen = new libtherm.ThermalControlDevice(config);
 *
 */

exports.ThermalControlDevice = function (config) {
  if (!config.hasOwnProperty("devName")) {
    throw new Error("There isn't device ID in config!");
  }
  if (!config.hasOwnProperty("temperatureSource")) {
    throw new Error(
      "{}:[There isn't temperature source in config!]".format(
        format(config.devName)
      )
    );
  }
  if (getControl(config.temperatureSource) === undefined) {
    throw new Error(
      "{}:[Problem with temperature source channel: topic [{}] does not exist]".format(
        config.devName,
        config.temperatureSource
      )
    );
  }
  devName = config.devName;

  var hysteresis = 1.0;
  if (config.hasOwnProperty("hysteresis") && config.hysteresis < 0) {
    throw new Error(
      "{}:[Hysteresis can not be negative]".format(format(config.devName))
    );
  }
  if (!isNaN(parseFloat(config.hysteresis))) {
    hysteresis = parseFloat(config.hysteresis);
  }

  var heatingChannel = "";
  var heatingChannelPresent = false;
  if (config.hasOwnProperty("heatingChannel")) {
    if (getControl(config.heatingChannel) === undefined) {
      throw new Error(
        "{}:[Problem with heating channel: topic [{}] does not exist]".format(
          config.devName,
          config.heatingChannel
        )
      );
    }
    heatingChannelPresent = true;
    heatingChannel = config.heatingChannel;
  }

  var coolingChannel = "";
  var coolingChannelPresent = false;
  if (config.hasOwnProperty("coolingChannel")) {
    if (getControl(config.coolingChannel) === undefined) {
      throw new Error(
        "{}:[Problem with cooling channel: topic [{}] does not exist]".format(
          config.devName,
          config.coolingChannel
        )
      );
    }
    coolingChannelPresent = true;
    coolingChannel = config.coolingChannel;
  }

  var setpointMin = 5.0;
  var setpointMax = 35.0;
  var setpointDefault = 23.0;

  if (config.hasOwnProperty("setpoint")) {
    if (!("min" in config.setpoint)) {
      throw new Error(
        "{}:[Problem with setpoint: min value not defined]".format(
          config.devName
        )
      );
    }
    if (!("max" in config.setpoint)) {
      throw new Error(
        "{}:[Problem with setpoint: mix value not defined]".format(
          config.devName
        )
      );
    }
    if (!("default" in config.setpoint)) {
      throw new Error(
        "{}:[Problem with setpoint: default value not defined]".format(
          config.devName
        )
      );
    }

    if (!isNaN(parseFloat(config.setpoint.min))) {
      setpointMin = parseFloat(config.setpoint.min);
    } else {
      throw new Error(
        "{}:[Problem with setpoint: bad min value ({})]".format(
          config.devName,
          parseFloat(config.setpoint.min)
        )
      );
    }
    if (!isNaN(parseFloat(config.setpoint.max))) {
      setpointMax = parseFloat(config.setpoint.max);
    } else {
      throw new Error(
        "{}:[Problem with setpoint: bad max value ({})]".format(
          config.devName,
          parseFloat(config.setpoint.max)
        )
      );
    }
    if (!isNaN(parseFloat(config.setpoint.default))) {
      setpointDefault = parseFloat(config.setpoint.default);
    } else {
      throw new Error(
        "{}:[Problem with setpoint: bad default value ({})]".format(
          config.devName,
          parseFloat(config.setpoint.default)
        )
      );
    }
  }

  if (setpointMin >= setpointMax) {
    throw new Error("Maximal setpoint value must be greater than minimal");
  }
  if (setpointDefault > setpointMax || setpointDefault < setpointMin) {
    throw new Error(
      "Default setpoint ({}) value must be greater than minimal ({}) and smaller than maximal ({})".format(
        setpointDefault,
        setpointMax,
        setpointMin
      )
    );
  }

  if (config.debug) {
    log.info(
      "New thermal control device:\
    \n{\
    \nName: {}\
    \nTitle: {},\
    \nTemperature source: {}\
    \nHeating switch control: {}\
    \nCooling switch control: {}\
    \nModes: {}\
    \nSetpoint: [min : {}, max : {}, default : {}]\
    \nHysteresis: {}\
    \n}".format(
        devName,
        config.devTitle,
        config.temperatureSource,
        heatingChannel,
        coolingChannel,
        JSON.stringify(config.modes, null, 0),
        setpointMin,
        setpointMax,
        setpointDefault,
        hysteresis
      )
    );
  }
  this._device = _defineThermalControlDevice(config, setpointDefault);
  dev[devName]["hysteresis"] = hysteresis;
  if (isNaN(parseFloat(dev[devName]["setpoint"]))) {
    dev[devName]["setpoint"] = setpointDefault;
  }

  this._regulationRule = defineRule({
    whenChanged: devName + "/temperature",
    then: function () {
      setpoint = dev[devName]["setpoint"];
      temperature = dev[devName]["temperature"];
      heat = dev[devName]["devState"] == "HEATING";
      cool = dev[devName]["devState"] == "COOLING";
      // thermostat core
      if (temperature < setpoint) {
        cool = false;
        if (temperature < setpoint - hysteresis) {
          heat = true;
        }
      }
      if (temperature > setpoint) {
        heat = false;
        if (temperature > setpoint + hysteresis) {
          cool = true;
        }
      }
      // thermostat output
      if (dev[devName]["devEnabled"]) {
        if (config.hasOwnProperty("modes")) {
          heat = heat && config.modes.indexOf("heating") !== -1;
          cool = cool && config.modes.indexOf("cooling") !== -1;
        }
        if (heatingChannelPresent) {
          dev[heatingChannel] = heat;
        }
        if (coolingChannelPresent) {
          dev[coolingChannel] = cool;
        }
        if (heat) {
          dev[devName]["devState"] = "HEATING";
        } else if (cool) {
          dev[devName]["devState"] = "COOLING";
        } else {
          dev[devName]["devState"] = "IDLE";
        }
      }
    }.bind(this),
  });

  this._temperatureUpdateRule = defineRule({
    whenChanged: config.temperatureSource,
    then: function () {
      dev[devName]["temperature"] = parseFloat(dev[config.temperatureSource]);
    }.bind(this),
  });

  this._enableSwitchRule = defineRule({
    whenChanged: devName + "/devEnabled",
    then: function (value) {
      if (value) {
        dev[devName]["devState"] = "IDLE";
        if (config.debug) {
          log.info("{}:[Thermostat ENABLED now]".format(devName));
        }
        enableRule(this._regulationRule);
        runRule(this._regulationRule);
      } else {
        disableRule(this._regulationRule);
        dev[devName]["devState"] = "DISABLED";
        if (heatingChannelPresent) {
          dev[heatingChannel] = false;
        }
        if (coolingChannelPresent) {
          dev[coolingChannel] = false;
        }
        if (config.debug) {
          log.info("{}:[Thermostat DISABLED now]".format(devName));
        }
      }
    }.bind(this),
  });

  this._setpointControl = defineRule({
    whenChanged: devName + "/setpoint",
    then: function () {
      setpoint = dev[devName]["setpoint"];
      if (setpoint > setpointMax) {
        dev[devName]["setpoint"] = setpointMax;
        log.error(
          "{}:[You tried to set setpoint ({})\
          greater than maximum setting ({}})]".format(
            devName,
            setpoint,
            setpointMax
          )
        );
      }
      if (setpoint < setpointMin) {
        dev[devName]["setpoint"] = setpointMin;
        log.error(
          "{}:[You tried to set setpoint ({})\
          lower than maximum setting ({}})]".format(
            devName,
            setpoint,
            setpointMin
          )
        );
      }
      runRule(this._regulationRule);
    }.bind(this),
  });

  runRule(this._setpointControl);
  runRule(this._regulationRule);
};
