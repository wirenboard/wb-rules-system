var updateIntervalMs = 1000; //Интервал обновления данных (мс)

var vdev = defineVirtualDevice('battery', {
    title: "Battery",
    cells: {
    }
});

var powerSuppliesData = {};
var powerSupplyNamesByType = {};

function collectDataFromPowerSupply(name) {
    runShellCommand("udevadm info --query=property /sys/class/power_supply/{}".format(name), {
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

            if (dataMap["TYPE"]) {
                if (dataMap["PRESENT"] != "0") {
                        // do not overwrite if one power supply of this type is already found
                        if (!powerSupplyNamesByType.hasOwnProperty(dataMap["TYPE"])) {
                        powerSupplyNamesByType[dataMap["TYPE"]] = name;
                    }
                } else {
                    if (powerSupplyNamesByType[dataMap["TYPE"]] == name) {
                        delete powerSupplyNamesByType[dataMap["TYPE"]];
                    }
                }
            }
        }
    });
};

function collectData() {
    // iterate over power_supply instances
    runShellCommand("ls -1 /sys/class/power_supply/", {
        captureOutput : true,
        exitCallback: function (exitCode, capturedOutput) {
            var newPowerSupplyList = capturedOutput.split('\n');

            // query and update information for present power supplies
            newPowerSupplyList.forEach(function(line) {
                if (line) {
                    collectDataFromPowerSupply(line);
                }
            });

            // remove power supplies which are no longer present
            Object.keys(powerSupplyNamesByType).forEach(function(psType) {
                psName = powerSupplyNamesByType[psType];
                if (newPowerSupplyList.indexOf(psName) == -1) {
                    delete powerSupplyNamesByType[psType];
                }
            });

            Object.keys(powerSuppliesData).forEach(function(psName) {
                if (newPowerSupplyList.indexOf(psName) == -1) {
                    log.info("power supply {} is no longer present".format(psName));
                    delete powerSuppliesData[psName];
                }
            });
        }
    });
};

function createControlOrSetValue(vdevObj, controlName, controlDesc, initialValue)
{
    if (!vdevObj.isControlExists(controlName)) {
        var desc = Object(controlDesc);
        desc.value = initialValue;
        vdevObj.addControl(controlName, desc);
    };

    vdevObj.getControl(controlName).setValue({value: initialValue, notify: false});
}

function updateControl(vdevObj, psData, psPropertyName, controlName, controlType, scale, precision) {
    if (!psData.hasOwnProperty(psPropertyName))
        return;

    var value = Number(psData[psPropertyName]) / scale;
    if (precision != null) {
        value = Math.round((value) * Math.pow(10,precision)) / Math.pow(10,precision);
    }
    createControlOrSetValue(vdevObj, controlName, {"type" : controlType}, value)
}

function removeControlIfExists(vdevObj, controlName) {
    if (vdevObj.isControlExists(controlName)) {
        vdevObj.removeControl(controlName);
    }
}

var chargingStateSetTime = null;
defineRule({
    whenChanged: "battery/Charging",
    then: function (newValue) {
        log("changed {}".format(newValue));
        var batName = powerSupplyNamesByType["Battery"];
        var newState;
        if (newValue) {
            newState = "Charging";
        } else {
            newState = "Not charging";
        }
        runShellCommand("echo '{}' > /sys/class/power_supply/{}/status".format(newState, batName),{
            exitCallback: function (exitCode, capturedOutput) {
                if (exitCode == 0) {
                    chargingStateSetTime = new Date();
                } else {
                    // error writing new status, revert state
                    getControl("battery/Charging").setValue({value: !newValue, notify: false});
                }
            }
        });
    }
});

function updateChargingControl(vdevObj, psData) {
    if (!psData.hasOwnProperty("STATUS"))
        return;

    if (chargingStateSetTime)
        if ((new Date()) - chargingStateSetTime < 2500)
            return;

    var charging = false;
    if (psData["STATUS"] == "Charging")
        charging = true;

    createControlOrSetValue(vdevObj, "Charging", {"type" : "switch"}, charging);
}

function publishData() {
    var batName = powerSupplyNamesByType["Battery"];
    if (batName) {
        var batData = powerSuppliesData[batName];
        updateControl(vdev, batData, "CAPACITY", "Percentage", "value", 1);
        updateControl(vdev, batData, "CURRENT_NOW", "Current", "value", 1000000);
        updateControl(vdev, batData, "VOLTAGE_NOW", "Voltage", "voltage", 1000000);
        updateControl(vdev, batData, "POWER_NOW", "Power", "power", 1000000, 2);

        updateChargingControl(vdev, batData);
    } else {
        removeControlIfExists(vdev, "Percentage");
        removeControlIfExists(vdev, "Current");
        removeControlIfExists(vdev, "Voltage");
        removeControlIfExists(vdev, "Charging");
        removeControlIfExists(vdev, "Power");
    }

    var mainsName = powerSupplyNamesByType["Mains"];
    if (mainsName) {
        var mainsData = powerSuppliesData[mainsName];
        if (mainsData.hasOwnProperty("ONLINE")) {
            var mainsOnline =  (mainsData["ONLINE"] == "1");
            dev["power_status/working on battery"] = !mainsOnline;
        }
    }
};

function update() {
    collectData();
    publishData();
}

setInterval(update, updateIntervalMs);
