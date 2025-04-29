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
  var disable_before_setup = false;

  function enable_pwm_command() {
    return 'echo {} > {}/pwm{}/enable'.format(1, pwm_sys, pwm_number)
  }

  function disable_pwm_command() {
    return 'echo {} > {}/pwm{}/enable'.format(0, pwm_sys, pwm_number)
  }

  var enabler = function() {
    runShellCommand(enable_pwm_command());
  }

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

  // WB 8.4.x uses internal CPU PWM for buzzer.
  // It has a bug in driver that stops PWM if parameters are changed on enabled PWM.
  runShellCommand("bash -c '. /usr/lib/wb-utils/wb_env.sh && wb_source of && of_machine_match \"wirenboard,wirenboard-84x\"'", {
    exitCallback: function (exitCode) {
      disable_before_setup = (exitCode == 0);
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
         if (disable_before_setup) {
          runShellCommand(disable_pwm_command(), { exitCallback: function () { _buzzer_set_params(enabler); } });
        } else {
          _buzzer_set_params();
        }
      }
    },
  });

  defineRule('_system_buzzer_onof', {
    whenChanged: 'buzzer/enabled',
    then: function (newValue, devName, cellName) {
      if (dev.buzzer.enabled) {
        _buzzer_set_params(enabler);
      } else {
        runShellCommand(disable_pwm_command());
      }
    },
  });
})();
