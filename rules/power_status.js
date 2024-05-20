defineVirtualDevice('power_status', {
  title: {en: 'Power status', ru: 'Статус питания'},
  cells: {
    'working on battery': {title: {en: 'Working on battery', ru: 'Работа от батареи'}, type: 'switch', value: false, readonly: true},
    'Vin': {title: {en: 'Input voltage', ru: 'Входное напряжение'}, type: 'voltage', value: 0}
  }
});

defineRule('_system_track_vin', {
  whenChanged: ['wb-adc/Vin', 'power_status/working on battery'],
  then: function () {
    dev.power_status['Vin'] = dev.power_status['working on battery'] ? 0 : dev['wb-adc']['Vin'];
  }
});

/* Power status reporting for Wiren Board 5.x is based on
    1) Vin value (normally above 7V)
    2) Battery present status
    3) Battery charging status
*/

spawn('bash', ['-c', '. /etc/wb_env.sh && wb_source of && of_machine_match "contactless,imx28-wirenboard50"'], {
  captureOutput: false,
  exitCallback: function (code) {
    if (code !== 0) return;

    // get power status, we don't expect the voltage to go up and down
    // around the threshold, so no hysteresis here

    defineRule('_system_wb5_track_power_status', {
      whenChanged: function () {
        return (dev['wb-gpio/BATTERY_PRESENT'] && !dev['wb-gpio/BATTERY_CHARGING'] && dev['wb-adc/Vin'] < 5.0);
      },
      then: function (state) {
        dev.power_status['working on battery'] = state;
      }
    });
  }
});