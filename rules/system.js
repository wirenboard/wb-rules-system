var systemCells = {
  'Current uptime': {
    title: { en: 'Current uptime', ru: 'Время работы' },
    type: 'text',
    value: '0',
    order: 8,
  },
  'Short SN': {
    title: { en: 'Short SN', ru: 'Серийный номер' },
    type: 'text',
    value: '',
    order: 1,
  },
  'Release suite': {
    title: { en: 'Release suite', ru: 'Тип релиза' },
    type: 'text',
    value: '',
    order: 7,
  },
  'Release name': {
    title: { en: 'Release name', ru: 'Название релиза' },
    type: 'text',
    value: '',
    order: 6,
  },
  Reboot: {
    title: { en: 'Reboot', ru: 'Перезагрузить' },
    type: 'pushbutton',
    order: 9,
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
      order: 5,
    };
    systemCells['Batch No'] = {
      title: { en: 'Batch No', ru: 'Номер партии' },
      type: 'text',
      value: '',
      order: 2,
    };
    systemCells['Manufacturing Date'] = {
      title: { en: 'Manufacturing Date', ru: 'Дата производства' },
      type: 'text',
      value: '',
      order: 3,
    };
    systemCells['Temperature Grade'] = {
      title: { en: 'Temperature Grade', ru: 'Температурный диапазон' },
      type: 'text',
      value: '',
      order: 4,
    };
  }

  defineVirtualDevice('system', {
    title: { en: 'System', ru: 'Система' },
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

  getReleaseInfoProperty('RELEASE_NAME', 'Release name');
  getReleaseInfoProperty('SUITE', 'Release suite');

  defineRule('_system_reboot', {
    whenChanged: ['system/Reboot'],
    then: function (newValue, devName, cellName) {
      runShellCommand('reboot &');
    },
  });
}
