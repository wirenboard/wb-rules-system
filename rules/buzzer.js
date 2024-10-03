(function () {
  defineVirtualDevice('buzzer', {
    title: { en: 'Buzzer', ru: 'Зуммер' },

    cells: {
      frequency: {
        title: { en: 'Frequency', ru: 'Частота' },
        type: 'range',
        value: 3000,
        max: 7000,
      },
      volume: {
        title: { en: 'Volume', ru: 'Громкость' },
        type: 'range',
        value: 10,
        max: 100,
      },
      enabled: {
        title: { en: 'Enabled', ru: 'Включен' },
        type: 'switch',
        value: false,
      },
    },
  });

  var pwm_sys = '/sys/class/pwm/pwmchip0';
  var pwm_number = 2;

  runShellCommand("bash -c '. /etc/wb_env.sh && echo -n $WB_PWM_BUZZER'", {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (capturedOutput) {
        pwm_number = parseInt(capturedOutput);
      }

      runShellCommand(
        '[ -e {}/pwm{} ] || echo {} > {}/export'.format(pwm_sys, pwm_number, pwm_number, pwm_sys)
      );
    },
  });

  function _buzzer_set_params(exitCallback) {
    var period = parseInt((1.0 / dev.buzzer.frequency) * 1e9) || 0;
    var duty_cycle = parseInt(((dev.buzzer.volume * 1.0) / 100) * period * 0.5);

    if (!exitCallback) {
        exitCallback = function () {};
    }

    runShellCommand('echo {} > {}/pwm{}/period ;'.format(period, pwm_sys, pwm_number) +
                    'echo {} > {}/pwm{}/duty_cycle ;'.format(duty_cycle, pwm_sys, pwm_number) +
                    'echo normal > {}/pwm{}/polarity'.format(pwm_sys, pwm_number), {
        exitCallback: exitCallback
    });
  }

  defineRule('_system_buzzer_params', {
    whenChanged: ['buzzer/frequency', 'buzzer/volume'],

    then: function (newValue, devName, cellName) {
      if (dev.buzzer.enabled) {
        _buzzer_set_params();
      }
    },
  });

  defineRule('_system_buzzer_onof', {
    whenChanged: 'buzzer/enabled',
    then: function (newValue, devName, cellName) {
      var enabler = function() {
        runShellCommand(
          'echo {} > {}/pwm{}/enable'.format(dev.buzzer.enabled ? 1 : 0, pwm_sys, pwm_number)
        );
      }
      if (dev.buzzer.enabled) {
        _buzzer_set_params(enabler);
      } else {
        enabler();
      }
    },
  });
})();
