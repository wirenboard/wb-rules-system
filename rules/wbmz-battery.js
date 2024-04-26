/* Power status for Wiren Board 6.x/6.7.x with wbmzX-battery module */

var params = {
	correction: 0,
	trigger: null,
	hysteresis: 0.01,
	threshold: -0.02,
	rcg_ohm: 0.025 // gas gauge sense resistor (Ω) (10 to 50 mΩ)
}

function parse2ndComplement(raw) {
	return (raw > 0x2000) ? raw - 0x4000 : raw;
}

function parse2ndComplement16(raw) {
	return (raw > 0x8000) ? raw - 0x10000 : raw;
}

/* Функция сброса калибровочных значений */

function reset() {
	runShellCommand('i2cset -y {} 0x70 0x01 0x02'.format(config.bus));
	wbmz2_ps.correction = params.correction;
	wbmz2_ps.min = 0;
	wbmz2_ps.max = 0;
	wbmz2_ps.batteryСapacity = 0;
}

/* Функция читения данных */

function readI2cData() {
	runShellCommand("i2cdump -y -r 0x01-0x0C {} 0x70 c | grep 00: | sed -e 's/00: //g' -e 's/    .*//g'".format(config.bus), {
		captureOutput: true,
		exitCallback: function (code, output) {
			// Записываем в /meta/error значение "r" в случае ошибки чтения данных и удаляем его если данные успешно прочитаны
			['Current', 'Voltage', 'Temperature', 'Charge', 'Percentage'].forEach(function(ctrl) {
				publish('/devices/battery/controls/{}/meta/error'.format(ctrl), (!output ? 'r' : ''), 2, true);
			});

			// Оставливаем дальнейший код если нет выходных данных
			if (!output) return; 

			// Массив с полученными данными
			var data = output.trim().split(' ');

			// Вычисление силы тока
			var currentRaw = parseInt('0x' + data[6] + data[5], 16);
			var voltage_uv = 11.77 * parse2ndComplement(currentRaw); // The battery current is coded in 2’s complement format, and the LSB value is 11.77 uV
			var current = Math.round(((voltage_uv * 1e-6) / params.rcg_ohm) * 1000) / 1000;

			dev.battery['Current'] = current;

			// Вычисление напряжения
			var voltageRaw = parseInt('0x' + data[8] + data[7], 16);
			var voltage_mv = 2.44 * voltageRaw; // resolution is 2.44 mV

			dev.battery['Voltage'] = Math.round(voltage_mv * 1e-3 * 1000) / 1000;

			// Вычисление температуры
			var temperatureRaw = parseInt('0x' + data[10] + data[9], 16);
			var temperature = 0.125 * parse2ndComplement(temperatureRaw); // resolution is 0.125° C

			dev.battery['Temperature'] = Math.round(temperature * 1000) / 1000;

			// Вычисление заряда (mAh)
			var сhargeRaw = parseInt('0x' + data[2] + data[1], 16);
			var charge_uvh = 6.7 * parse2ndComplement16(сhargeRaw); // The charge data is coded in 2’s complement format, and the LSB value is 6.70 uV.h.
			var charge_mah = charge_uvh * 1e-3 / params.rcg_ohm;

			if (charge_mah < wbmz2_ps.min) {
				wbmz2_ps.min = charge_mah;
			}
			else if (charge_mah > wbmz2_ps.max) {
				wbmz2_ps.max = charge_mah;
			}

			wbmz2_ps.batteryСapacity = wbmz2_ps.max - wbmz2_ps.min;

			if (charge_mah - wbmz2_ps.correction < 0) {
				wbmz2_ps.correction = charge_mah;
			}
			else if (charge_mah - wbmz2_ps.correction > wbmz2_ps.batteryСapacity) {
				wbmz2_ps.correction = -(wbmz2_ps.batteryСapacity - charge_mah);
			}

			dev.battery['Charge'] = Math.round((charge_mah - wbmz2_ps.correction) * 100) / 100;
			dev.battery['Percentage'] = Math.round((charge_mah - wbmz2_ps.correction) / (wbmz2_ps.batteryСapacity / 100));

			//

			if (lastTrigger != null && Math.abs(current - lastTrigger) < params.hysteresis) return;

			var state = current < params.threshold;

			if (dev.power_status['working on battery'] != state) {
				dev.power_status['working on battery'] = state;
				params.trigger = current;
			}
		}
	});
}

var wbmz2_ps = new PersistentStorage('wbmz2-battery', {global: true}); // глобальное хранилище для калибровочных значений

var updateIntervalMs = 3000; // интервал обновления данных (мс)
var config = readConfig('/etc/wbmz2-battery.conf');

if (config.enable) {
	runShellCommand('i2cset -y {} 0x70 0x00 0x10'.format(config.bus));

	var controls = {
		Percentage: {title: {en: 'Charge left', ru: 'Остаток'}, type: 'value', value: 0},
		Charge: {title: {en: 'Charge', ru: 'Зарядка'}, type: 'value', value: 0},
		Current: {title: {en: 'Current', ru: 'Потребление'}, type: 'value', value: 0},
		Voltage: {title: {en: 'Voltage', ru: 'Напряжение'}, type: 'voltage', value: 0},
		Temperature: {title: {en: 'Temperature', ru: 'Температура'}, type: 'temperature', value: 0},
	};

	if (config.resetButon) {
		controls['Reset'] = {title: {en: 'Reset', ru: 'Сброс'}, type: 'pushbutton'};

		defineRule('_reset_calib', {
			whenChanged: 'battery/Reset',
			then: function () {
				reset();
			}
		});
	}

	if (!wbmz2_ps.correction) reset();

	defineVirtualDevice('battery', {
		title: {en: 'Battery', ru: 'Батарея'},
		cells: controls
	});

	setInterval(readI2cData, updateIntervalMs);
}