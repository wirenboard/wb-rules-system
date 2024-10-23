/**
 * @file Модуль для инициализации прямой или инвертированной связи
 *       между двумя switch топиками MQTT
 * @author Vitalii Gaponov <vitalii.gaponov@wirenboard.com>
 * @link Комментарии в формате JSDoc <https://jsdoc.app/>
 */

/**
 * Инициализирует виртуальное устройство и определяет правило для управления
 * устройством
 * @param {string} scenarioName - Название сценария, используемое для
 *                                идентификации виртуального устройства
 * @param {string} inControl - Идентификатор входного контроля, значение
 *                                которого следует слушать
 *                                Пример: "vd_wall_switch/enabled"
 * @param {string} outControl - Идентификатор выходного контроля, значение
 *                                 которого следует контролировать
 *                                 Пример: "vd_pump/enabled"
 * @param {boolean} inverseLink - Указывает, должна ли связь быть
 *                                инвертированной
 */
function init(scenarioName, inControl, outControl, inverseLink) {
  device = defineVirtualDevice("GenVd_" + scenarioName, {
    title: "Generated VD: " + scenarioName, 
    cells: {
      enabled: {
        type: "switch",
        value: false
      },
    } 
  });

  defineRule("generated_rule_" + scenarioName, {
    whenChanged: inControl,
    then: function (newValue, devName, cellName) {
      // Проверка инверсии и присваивание значения в зависимости от него
      if (inverseLink) {
        dev[outControl] = !newValue; // Инвертирование значения
      } else {
        dev[outControl] = newValue; // Прямое присваивание значения
      }
    }
  });
};

exports.init = function (scenarioName, inControl, outControl, inverseLink) {
  init(scenarioName, inControl, outControl, inverseLink);
};
