defineVirtualDevice('system', {
  title: {en: 'System information', ru: 'Системная информация'},
  cells: {
    'Current uptime': {title: {en: 'Current uptime', ru: 'Время работы'}, type: 'text', value: '', order: 2},
    'Reboot': {title: {en: 'Reboot', ru: 'Перезагрузить'}, type: 'pushbutton', order: 10}
  }
});

spawn('sh', ['-c', '[ -d /proc/device-tree/wirenboard ]'], {
  captureOutput: true,
  exitCallback: function (code) {
    var metrics = {
      'HW Revision': {en: 'HW Revision', ru: 'Аппаратная ревизия', cmd: 'cat', query: ['/proc/device-tree/wirenboard/board-revision'], pos: 4},
      'Batch No': {en: 'Batch No', ru: 'Номер партии', cmd: 'cat', query: ['/proc/device-tree/wirenboard/batch-no'], pos: 1},
      'Manufacturing Date': {en: 'Manufacturing Date', ru: 'Дата производства', cmd: 'cat', query: ['/proc/device-tree/wirenboard/date'], pos: 5},
      'Temperature Grade': {en: 'Temperature Grade', ru: 'Тип исполнения', cmd: 'cat', query: ['/proc/device-tree/wirenboard/temperature/grade'], pos: 14},

      'Short SN': {en: 'Short SN', ru: 'Серийный номер', cmd: 'cat', query: ['/var/lib/wirenboard/short_sn.conf'], pos: 13},
      'DTS Version': {en: 'DTS Version', ru: 'Версия DTS', cmd: 'bash', query: ['-c', '. /etc/wb_env.sh && echo $WB_VERSION'], pos: 3},

      'Release name': {en: 'Release name', ru: 'Название релиза', cmd: 'sh', query: ['-c', '. /usr/lib/wb-release && echo $RELEASE_NAME'], pos: 11},
      'Release suite': {en: 'Release suite', ru: 'Тип релиза', cmd: 'sh', query: ['-c', '. /usr/lib/wb-release && echo $SUITE'], pos: 12}
    };

    Object.keys(metrics).forEach(function(key) {
      var item = metrics[key];

      if (item.query[0].match('/device-tree/') && code) return;

      spawn(item.cmd, item.query, {
        captureOutput: true,
        exitCallback: function (code, output) {
          getDevice('system').addControl(key, {title: {en: item.en, ru: item.ru}, type: 'text', value: output.trim(), order: item.pos});
        }
      });
    });
  }
});

defineRule('_system_reboot', {
  whenChanged: 'system/Reboot',
  then: function () {
    runShellCommand('reboot &');
  }
});

(function _system_update_uptime() {
  runShellCommand('awk \'{print int($1/86400)"d "int(($1%86400)/3600)"h "int(($1%3600)/60)"m"}\' /proc/uptime', {
    captureOutput: true,
    exitCallback: function (code, output) {
      getDevice('system').getControl('Current uptime').setValue(output.trim());
    }
  });

  setTimeout(_system_update_uptime, 60 * 1000);
})();