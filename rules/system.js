var systemCells = {
  'Current uptime': {
    title: { en: 'Current uptime', ru: 'Время работы' },
    type: 'text',
    value: '0',
  },
  'Short SN': {
    title: { en: 'Short SN', ru: 'Серийный номер' },
    type: 'text',
    value: '',
  },
  'DTS Version': {
    title: { en: 'DTS Version', ru: 'Версия DTS' },
    type: 'text',
    value: '',
  },
  'Release suite': {
    title: { en: 'Release suite', ru: 'Тип релиза' },
    type: 'text',
    value: '',
  },
  'Release name': {
    title: { en: 'Release name', ru: 'Название релиза' },
    type: 'text',
    value: '',
  },
  Reboot: {
    title: { en: 'Reboot', ru: 'Перезагрузить' },
    type: 'pushbutton',
  },
};

function _system_update_uptime() {
  runShellCommand(
    'awk \'{print int($1/86400)"d "int(($1%86400)/3600)"h "int(($1%3600)/60)"m"}\' /proc/uptime',
    {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        dev.system['Current uptime'] = capturedOutput.trim();
      },
    }
  );
}

spawn('sh', ['-c', '[ -d /proc/device-tree/wirenboard ]'], {
  captureOutput: true,
  exitCallback: function (exitCode, capturedOutput) {
    var hasWirenboardNode = exitCode == 0;

    initSystemDevice(hasWirenboardNode);
  },
});

function fillWirenboardNodeProperty(controlName, propertyName) {
  spawn('cat', ['/proc/device-tree/wirenboard/' + propertyName], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode == 0) {
        dev.system[controlName] = capturedOutput.trim();
      }
    },
  });
}

function getReleaseInfoProperty(property, cell) {
  spawn('sh', ['-c', '. /usr/lib/wb-release && echo $' + property], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system[cell] = capturedOutput.trim();
    },
  });
}

function initSystemDevice(hasWirenboardNode) {
  if (hasWirenboardNode) {
    systemCells['HW Revision'] = {
      title: { en: 'HW Revision', ru: 'Версия контроллера' },
      type: 'text',
      value: '',
    };
    systemCells['Batch No'] = {
      title: { en: 'Batch No', ru: 'Номер партии' },
      type: 'text',
      value: '',
    };
    systemCells['Manufacturing Date'] = {
      title: { en: 'Manufacturing Date', ru: 'Дата производства' },
      type: 'text',
      value: '',
    };
    systemCells['Temperature Grade'] = {
      title: { en: 'Temperature Grade', ru: 'Температурный диапазон' },
      type: 'text',
      value: '',
    };
  }

  defineVirtualDevice('system', {
    title: 'System',
    cells: systemCells,
  });

  if (hasWirenboardNode) {
    fillWirenboardNodeProperty('HW Revision', 'board-revision');
    fillWirenboardNodeProperty('Batch No', 'batch-no');
    fillWirenboardNodeProperty('Manufacturing Date', 'date');
    fillWirenboardNodeProperty('Temperature Grade', 'temperature/grade');
  }

  _system_update_uptime();
  setInterval(_system_update_uptime, 60000);

  spawn('cat', ['/var/lib/wirenboard/short_sn.conf'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system['Short SN'] = capturedOutput.trim();
    },
  });

  spawn('bash', ['-c', '. /etc/wb_env.sh && echo $WB_VERSION'], {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      dev.system['DTS Version'] = capturedOutput;
    },
  });

  getReleaseInfoProperty('RELEASE_NAME', 'Release name');
  getReleaseInfoProperty('SUITE', 'Release suite');

  defineRule('_system_reboot', {
    whenChanged: ['system/Reboot'],
    then: function (newValue, devName, cellName) {
      runShellCommand('reboot &');
    },
  });
}
