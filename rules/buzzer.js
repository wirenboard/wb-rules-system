(function () {
	defineVirtualDevice('buzzer', {
		title: {en: 'Integrated buzzer', ru: 'Встроенный зуммер'},
		cells: {
			frequency: {title: {en: 'Frequency', ru: 'Частота'}, type: 'range', value: 3000, max: 7000},
			volume: {title: {en: 'Volume', ru: 'Громкость'}, type: 'range', value: 10, max: 100},
			enabled: {title: {en: 'Enabled', ru: 'Включен'}, type: 'switch', value: false}
		}
	});

	var pwm_sys = '/sys/class/pwm/pwmchip0';
	var pwm_number = 2;

	runShellCommand("bash -c '. /etc/wb_env.sh && echo -n $WB_PWM_BUZZER'", {
		captureOutput: true,
		exitCallback: function (code, output) {
			pwm_number = !output ? pwm_number : parseInt(output);
			runShellCommand('[ -e {}/pwm{} ] || echo {} > {}/export'.format(pwm_sys, pwm_number, pwm_number, pwm_sys));
		}
	});

	defineRule('_system_buzzer_triggers', {
		whenChanged: ['buzzer/frequency', 'buzzer/volume', 'buzzer/enabled'],
		then: function () {
			var period = parseInt(1.0 / dev.buzzer.frequency * 1e9);
			var duty_cycle = parseInt(dev.buzzer.volume * 1.0 / 100 * period * 0.5);

			runShellCommand([
				'echo {} > {}/pwm{}/period'.format(period, pwm_sys, pwm_number),
				'echo {} > {}/pwm{}/duty_cycle'.format(duty_cycle, pwm_sys, pwm_number).
				'echo {} > {}/pwm{}/enable'.format(dev.buzzer.enabled & 1, pwm_sys, pwm_number
			]);
		}
	});
})();