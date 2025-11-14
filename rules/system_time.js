/**
 * @file system_time.js - ES5 module for wb-rules v2.35
 * @description system time virtual device module
 * @author Ivan Praulov <ivan.praulov@wirenboard.com>
 */

var systemTimeCells = {
  'timezone': {
    title: { en: 'Timezone', ru: 'Часовая зона' },
    type: 'text',
    order: 3,
    value: '',
  },
  'current_date': {
    title: { en: 'Current date', ru: 'Текущая дата' },
    type: 'text',
    order: 1,
    value: '',
  },
  'current_time': {
    title: { en: 'Current time', ru: 'Текущее время' },
    type: 'text',
    order: 2,
    value: '',
  },
};

function _padZero(num) {
  var str = String(num);
  return str.length < 2 ? '0' + str : str;
}

function _formatTimezone(offset) {
  var hours = Math.abs(Math.floor(offset / 60));
  var minutes = Math.abs(offset % 60);
  var sign = offset <= 0 ? '+' : '-';
  return 'UTC' + sign + _padZero(hours) + _padZero(minutes);
}

function _system_time_update_datetime() {
  try {
    var now = new Date();
    
    var dateStr = now.getFullYear() + '-' + 
                _padZero(now.getMonth() + 1) + '-' + 
                _padZero(now.getDate());
    
    var timeStr = _padZero(now.getHours()) + ':' + 
                _padZero(now.getMinutes());

    var timezoneStr = _formatTimezone(now.getTimezoneOffset());
    
    dev['system_time']['timezone'] = timezoneStr;
    dev['system_time']['current_date'] = dateStr;
    dev['system_time']['current_time'] = timeStr;
  } catch (error) {
    log.error('system_time: Failed to update datetime: {}', error.message);
  }
}

defineVirtualDevice('system_time', {
  title: { en: 'System Time', ru: 'Системное время' },
  cells: systemTimeCells,
});

_system_time_update_datetime();
setInterval(_system_time_update_datetime, 60000);