/**
 * @file system_time.js - ES5 module for wb-rules v2.35
 * @description system time virtual device module
 * @author Ivan Praulov <ivan.praulov@wirenboard.com>
 */

var systemTimeCells = {
  'current_date': {
    title: { en: 'Date', ru: 'Дата' },
    type: 'text',
    order: 1,
    value: '',
  },
  'current_day': {
    title: { en: 'Day of week', ru: 'День недели' },
    type: 'value',
    order: 2,
    value: 7,
    forceDefault: true,
    enum: {
      0: {
        en: 'Sunday',
        ru: 'Воскресенье',
      },
      1: {
        en: 'Monday',
        ru: 'Понедельник',
      },
      2: {
        en: 'Tuesday',
        ru: 'Вторник',
      },
      3: {
        en: 'Wednesday',
        ru: 'Среда',
      },
      4: {
        en: 'Thursday',
        ru: 'Четверг',
      },
      5: {
        en: 'Friday',
        ru: 'Пятница',
      },
      6: {
        en: 'Saturday',
        ru: 'Суббота',
      },
      7: {
        en: 'Not initialized',
        ru: 'Не инициализировано',
      }
    }
  },
  'current_time': {
    title: { en: 'Time', ru: 'Время' },
    type: 'text',
    order: 3,
    value: '',
  },
  'timezone': {
    title: { en: 'Timezone', ru: 'Часовой пояс' },
    type: 'text',
    order: 4,
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
    
    // Calculate time until next minute + 100ms
    var secondsUntilNextMinute = 60 - now.getSeconds();
    var millisecondsUntilNextMinute = secondsUntilNextMinute * 1000 - now.getMilliseconds() + 100;
    
    // Schedule timer to update at the start of new minute
    setTimeout(function() {
      try {
        // Get new time (already next minute)
        var newNow = new Date();
        
        var dayNum = newNow.getDay();
        
        var dateStr = newNow.getFullYear() + '-' + 
                    _padZero(newNow.getMonth() + 1) + '-' + 
                    _padZero(newNow.getDate());
        
        var timeStr = _padZero(newNow.getHours()) + ':' + 
                    _padZero(newNow.getMinutes());

        var timezoneStr = _formatTimezone(newNow.getTimezoneOffset());
        
        dev['system_time']['timezone'] = timezoneStr;
        dev['system_time']['current_date'] = dateStr;
        dev['system_time']['current_day'] = dayNum;
        dev['system_time']['current_time'] = timeStr;
      } catch (error) {
        log.error('system_time: Failed to update datetime in timeout: {}', error.message);
      }
    }, millisecondsUntilNextMinute);
  } catch (error) {
    log.error('system_time: Failed to schedule datetime update: {}', error.message);
  }
}

defineVirtualDevice('system_time', {
  title: { en: 'System Time', ru: 'Системное время' },
  cells: systemTimeCells,
});

_system_time_update_datetime();
setInterval(_system_time_update_datetime, 60000);