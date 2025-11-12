var systemTimeCells = {
  'Timezone': {
    title: { en: 'Timezone', ru: 'Часовая зона' },
    type: 'text',
    value: '',
  },
  'Current date': {
    title: { en: 'Current date', ru: 'Текущая дата' },
    type: 'text',
    value: '',
  },
  'Current time': {
    title: { en: 'Current time', ru: 'Текущее время' },
    type: 'text',
    value: '',
  },
};

function _system_time_update_datetime() {
  runShellCommand('date +"%Z (UTC%z)|%Y-%m-%d|%H:%M"', {
    captureOutput: true,
    exitCallback: function (exitCode, capturedOutput) {
      if (exitCode == 0) {
        var parts = capturedOutput.trim().split('|');
        if (parts.length === 3) {
          dev['system-time']['Timezone'] = parts[0];
          dev['system-time']['Current date'] = parts[1];
          dev['system-time']['Current time'] = parts[2];
        } else {
          log.error('system_time: Failed to parse date output, expected 3 parts but got {}: "{}"', parts.length, capturedOutput.trim());
        }
      } else {
        log.error('system_time: Date command failed with exit code {}, output: "{}"', exitCode, capturedOutput.trim());
      }
    }
  });
}

defineVirtualDevice('system-time', {
  title: { en: 'System Time', ru: 'Системное время' },
  cells: systemTimeCells,
});

_system_time_update_datetime();
setInterval(_system_time_update_datetime, 60000);