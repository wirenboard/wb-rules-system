var configPath = "/etc/wbmz2-battery.conf";
var rcg_ohm = 0.025; // Gas gauge sense resistor (Ω) (10 to 50 mΩ)
var updateIntervalMs = 3000; //Интервал обновления данных (мс)
var startChargeCorrection = 0; // Калибровочное значение по умолчанию
var config = readConfig(configPath);
var inited = false;
var wbmz2_ps = new PersistentStorage("wbmz2-battery", {global: true}); // Глобальное хранилище для калибровочных значений


/* Power status for Wiren Board 6.x/6.7.x with wbmzX-battery module */

var lastTriggeredCurrent = null;
var currentHysteresis = 0.01;
var dischargingThreshold = -0.02;


/*Сброс Калибровочных значений*/
function reset() {
    runShellCommand("i2cset -y {} 0x70 0x01 0x02".format(config.bus));
    wbmz2_ps.correction = startChargeCorrection;
    wbmz2_ps.min = 0;
    wbmz2_ps.max = 0;
    wbmz2_ps.batteryСapacity = 0;
};

function updatePowerStatus(newCurrent) {
    if (lastTriggeredCurrent != null)
        if (Math.abs(newCurrent - lastTriggeredCurrent) < currentHysteresis)
            return;

    var newStatus = (newCurrent < dischargingThreshold);

    if  (dev["power_status/working on battery"] != newStatus) {
        dev["power_status/working on battery"] = newStatus;
        lastTriggeredCurrent = newCurrent;
    }
}


function initDevice(resetButon) {
    /*Инициализация модуля*/
    runShellCommand("i2cset -y {} 0x70 0x00 0x10".format(config.bus));
    var cells = ({
        Percentage: {
            type: "value",
            value: 0
        },
        Charge: {
            type: "value",
            value: 0
        },
        Current: {
            type: "value",
            value: 0
        },
        Voltage: {
            type: "voltage",
            value: 0
        },
        Temperature: {
            type: "temperature",
            value: 0
        }
    });
    if (resetButon) {
        cells["Reset"] = ({
            type: "pushbutton",
        });
    };
    defineVirtualDevice("battery", {
        title: "Battery",
        cells: cells
    });

    if (!wbmz2_ps.correction) {
        reset();
    }
    inited = true;
}

defineRule("_reset_calib", {
    whenChanged: ["battery/Reset"],
    then: function(newValue, devName, cellName) {
        reset();
    }
});

function parse2ndComplement(raw) {
    if (raw > 0x2000) {
        return raw - 0x4000;
    } else {
        return raw;
    }
}

function parse2ndComplement16(raw) {
    if (raw > 0x8000) {
        return raw - 0x10000;
    } else {
        return raw;
    }
}

function readI2cData() {
    /*Читаем данные*/
    runShellCommand("i2cdump -y {} 0x70 s | grep 00: | sed -e 's/00: //g' -e 's/    .*//g'".format(config.bus), {
        captureOutput: true,
        exitCallback: function(exitCode, capturedOutput) {
            if (!capturedOutput) {
                /*Записываем в /meta/error значение "r" в случае ошибки чтения данных*/
                publish("/devices/battery/controls/Current/meta/error", "r", 2, true);
                publish("/devices/battery/controls/Voltage/meta/error", "r", 2, true);
                publish("/devices/battery/controls/Temperature/meta/error", "r", 2, true);
                publish("/devices/battery/controls/Charge/meta/error", "r", 2, true);
                publish("/devices/battery/controls/Percentage/meta/error", "r", 2, true);
            } else {
                /*Удаляем значение "r" из /meta/error если данные прочитаны */
                publish("/devices/battery/controls/Current/meta/error", "", 2, true);
                publish("/devices/battery/controls/Voltage/meta/error", "", 2, true);
                publish("/devices/battery/controls/Temperature/meta/error", "", 2, true);
                publish("/devices/battery/controls/Charge/meta/error", "", 2, true);
                publish("/devices/battery/controls/Percentage/meta/error", "", 2, true);

                /*Массив с полученными данными*/
                var arrayOfData = capturedOutput.split(' ');

                /*Сurrent*/
                var currentRaw = parseInt("0x" + arrayOfData[6] + arrayOfData[5], 16);
                var voltage_uv = 11.77 * parse2ndComplement(currentRaw); // The battery current is coded in 2’s complement format, and the LSB value is 11.77 uV
                var current = Math.round(voltage_uv * 1E-6 / rcg_ohm * 1000) / 1000;
                dev['battery']['Current'] = current;
                updatePowerStatus(current);

                /*Voltage*/
                var voltageRaw = parseInt("0x" + arrayOfData[8] + arrayOfData[7], 16);
                var voltage_mv = 2.44 * voltageRaw; // The resolution is 2.44 mV for the battery voltage.
                dev['battery']['Voltage'] = Math.round(voltage_mv * 1E-3 * 1000) / 1000;

                /*Temperature*/
                var temperatureRaw = parseInt("0x" + arrayOfData[10] + arrayOfData[9], 16);
                var temperature = 0.125 * parse2ndComplement(temperatureRaw); // The resolution is 0.125° C for the temperature.
                dev['battery']['Temperature'] = Math.round(temperature * 1000) / 1000;

                /*Charge (mAh)*/
                var сhargeRaw = parseInt("0x" + arrayOfData[2] + arrayOfData[1], 16);
                var charge_uvh = 6.70 * parse2ndComplement16(сhargeRaw); // The charge data is coded in 2’s complement format, and the LSB value is 6.70 uV.h.
                var charge_mah = charge_uvh * 1E-3 / rcg_ohm;

                if (charge_mah < wbmz2_ps.min) {
                    wbmz2_ps.min = charge_mah;
                } else if (charge_mah > wbmz2_ps.max) {
                    wbmz2_ps.max = charge_mah;
                }
                wbmz2_ps.batteryСapacity = wbmz2_ps.max - wbmz2_ps.min;

                if ((charge_mah - wbmz2_ps.correction) < 0) {
                    wbmz2_ps.correction = charge_mah;
                } else if ((charge_mah - wbmz2_ps.correction) > wbmz2_ps.batteryСapacity) {
                    wbmz2_ps.correction = -(wbmz2_ps.batteryСapacity - charge_mah);
                }
                dev['battery']['Charge'] = Math.round((charge_mah - wbmz2_ps.correction) * 100) / 100;
                dev['battery']['Percentage'] = Math.round((charge_mah - wbmz2_ps.correction) / (wbmz2_ps.batteryСapacity / 100));
            }
        }
    });
};

/*Обновление данных*/
function update() {
    config = readConfig(configPath);
    if (config.enable) {
        if (!inited) {
            initDevice(config.resetButon);
        }
        readI2cData();
    }
};
setInterval(update, updateIntervalMs);
