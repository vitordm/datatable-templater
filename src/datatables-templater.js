/**
 * Plugin DataTable Templater
 * @author Vítor Oliveira <oliveira.vitor3@gmail.com>
 */
(function () {
    function getObjectPropertyOrDefault(object, property, defaultValue = undefined, parseObject = undefined) {
        let value = object.hasOwnProperty(property) ? object[property] : defaultValue;

        if (parseObject && typeof value != parseObject) {
            if (parseObject == 'boolean') {
                value = value === 'true' ? true : false;
            }
        }

        return value;
    }

    function parseStringMatchValue(str, data) {
        let matches = str.match(/\{\$.*?\}/gi);
        if (!matches || matches.length <= 0)
            return str;
        matches.forEach(element => {
            let evalValue = element.replace(/^\{\$|\}/gi, '');
            try {
                eval(`evalValue = data['${evalValue}']`);
            } catch (e) {
                evalValue = '';
            }

            if (!evalValue) {
                evalValue = '';
            }

            str = str.replace(element, evalValue);
        });

        return str;
    }

    function parseActionsDataTableItem(item, actions) {
        let htmlResult = '';
        for (const action of actions) {
            const { href, type, onclick, label, condition } = action;
            let classAction = action.class;

            if (condition) {
                let conditionPassed = eval(parseStringMatchValue(condition, item));
                if (!conditionPassed)
                    continue;
            }

            let htmlTagActionAttributes = '';
            let isButton = false;


            let labelHtml = ''

            switch (type) {
                case 'EDIT':
                    labelHtml = window.DataTableTemplaterConfigs.editLabel;
                    if (!classAction)
                        classAction = window.DataTableTemplaterConfigs.editClass;
                    break;
                case 'DELETE':
                    labelHtml = window.DataTableTemplaterConfigs.deleteLabel;
                    if (!classAction)
                        classAction = window.DataTableTemplaterConfigs.deleteClass;
                    break;
                case 'VIEW':
                    labelHtml = window.DataTableTemplaterConfigs.viewLabel;
                    if (!classAction)
                        classAction = window.DataTableTemplaterConfigs.viewClass;
                    break;
                default:
                    labelHtml = label;
            }

            if (href) {
                htmlTagActionAttributes = `${htmlTagActionAttributes} href="${parseStringMatchValue(href, item)}"`;
            } else {
                isButton = true;
            }

            if (onclick) {
                htmlTagActionAttributes = `${htmlTagActionAttributes} onclick="${parseStringMatchValue(onclick, item)}"`;
            }

            if (classAction) {
                htmlTagActionAttributes = `${htmlTagActionAttributes} class="${classAction}"`;
            }

            if (isButton) {
                htmlResult += `<button ${htmlTagActionAttributes}>${labelHtml}</button>`
            } else {
                htmlResult += `<a ${htmlTagActionAttributes}>${labelHtml}</a>`
            }
        }

        return htmlResult;
    }

    /**
     * Cria DataTable a partir de uma Table criada
     * 
     * Modo de Usar:
     *  <table id="idTabela" 
     *      data-table-url="URL PARA BUSCA DOS DADOS | OBRIGATORIO" 
     *      data-url-edit="URL PARA EDICAO DE UM DADO | OPCIONAL"
     *      data-url-delete="URL PARA EDICAO DE UM DADO | OPCIONAL"
     *      data-url-view="URL PARA EDICAO DE UM DADO | OPCIONAL">
     *      ...
     *      <thead> 
     *          <tr>
     *              <th 
     *                  data-item-type="(number|string|date|datetime|integer|float|string-center|string-right|money|icon) | OBRIGATORIO=string "
     *                  data-item-iskey="(true|false) | OPCIONAL=false"
     *                  data-item-bind="nome do campo | obrigatorio"
     *                  data-column-visible="(true|false)| OPCIONAL"
     *                  data-column-orderable="(true|false) | OPCIONAL=false"
     *                  data-column-name="(string) | OPCIONAL"
     *                  data-column-searchable="(true|false) | OPCIONAL=false">
     *                  NOME DA HEADER
     *              </th>
     *          </tr>
     * 
     * JS: factoryDataTableFromHtml('ID_DA_TABLE', { OPTIONS }); => Id obrigatorio, options opcional    
     * 
     * Utilize:
     *  - {$NOME_CAMPO} => para realizar o bind de uma propiedade dentro da URL ou de data-item-text
     * 
     * @param {string} idTableHtml 
     * @returns {DataTable}
     */
    function factoryDataTableFromHtml(idTableHtml, options = {}) {
        if (!idTableHtml.match(/^\^/)) {
            idTableHtml = `#${idTableHtml}`;
        }

        if (!options.hasOwnProperty('actions') || !Array.isArray(options.actions)) {
            options.actions = [];
        }

        const tableJQuery = $(idTableHtml);

        const thsCollections = document.querySelector(`${idTableHtml} > thead > tr`).children
        const dataAttributes = [
            'data-item-type',
            'data-item-class',
            //'data-item-class-condition',
            'data-item-iskey',
            'data-item-bind',
            'data-column-name',
            'data-column-visible',
            'data-column-searchable',
            'data-item-text',
            'data-column-orderable',
            'data-column-ordernable'
        ];

        const typesAndClassesFields = {
            date: 'td-dates',
            datetime: 'td-dates',
            icon: 'td-icons',
            int: 'td-numbers ',
            float: 'td-numbers ',
            double: 'td-numbers ',
            number: 'td-numbers ',
            money: 'td-numbers ',
            string: 'td-text',
            'string-center': 'td-text-center',
            'string-right': 'td-text-right'
        };

        let hasKey = false;
        let keyColumn = 'id';
        let columnDefs = []; //datatable attribute
        let columns = [] //datatable attribute
        let indexColumns = -1;
        let hasActions = false;
        const columnsBinds = {};

        for (const th of thsCollections) {
            const attributesKeys = Object.keys(th.attributes);
            const thAttributes = attributesKeys.reduce((values, currentValue, currentIndex, array) => {
                const attribute = th.attributes[currentValue];
                if (!dataAttributes.includes(attribute.name))
                    return values;
                values[attribute.name] = attribute.value;
                return values;
            }, {});

            if (Object.keys(thAttributes) <= 0)
                continue;

            const itemType = getObjectPropertyOrDefault(thAttributes, 'data-item-type', '__custom');
            const classItemType = getObjectPropertyOrDefault(typesAndClassesFields, itemType, '');
            const visible = getObjectPropertyOrDefault(thAttributes, 'data-column-visible', true, 'boolean');

            if (itemType == 'actions') {
                hasActions = true;
                columns.push({ data: '__actions', visible, searchable: false });
                indexColumns++;
                columnDefs.push({ className: 'td-icons', orderable: false, targets: [indexColumns] });
                continue;
            }

            let ordernable = getObjectPropertyOrDefault(thAttributes, 'data-column-orderable', false, 'boolean');
            if (!ordernable)
                ordernable = getObjectPropertyOrDefault(thAttributes, 'data-column-ordernable', false, 'boolean');

            const searchable = getObjectPropertyOrDefault(thAttributes, 'data-column-searchable', false, 'boolean');
            const dataColumn = getObjectPropertyOrDefault(thAttributes, 'data-item-bind', '');
            const classDefined = getObjectPropertyOrDefault(thAttributes, 'data-item-class', '');
            const columnName = getObjectPropertyOrDefault(thAttributes, 'data-column-name', null);

            columns.push({ data: dataColumn, visible, searchable, name: columnName });
            indexColumns++;
            columnDefs.push({ className: `${classItemType} ${classDefined}`.trim(), ordernable, targets: [indexColumns] });

            const itemIsKey = getObjectPropertyOrDefault(thAttributes, 'data-item-iskey', false, 'boolean');
            if (itemIsKey && !hasKey) {
                keyColumn = dataColumn;
                hasKey = true;
            }
            const itemText = getObjectPropertyOrDefault(thAttributes, 'data-item-text');
            columnsBinds[dataColumn] = { classItemType, classDefined, itemType, visible, itemIsKey, itemText };
        }

        const url = tableJQuery.attr('data-table-url');

        const ajax = {
            method: "POST",
            url,
        };

        if (options.hasOwnProperty('data')) {
            ajax.data = options.data;
        }

        if (options.hasOwnProperty('beforeSend')) {
            ajax.beforeSend = options.beforeSend;
        }

        const optionsDatatable = {
            serverSide: true,
            columns,
            columnDefs,
            ajax
        };

        let callbackDataSrc;
        if (options.hasOwnProperty('callback')) {
            callbackDataSrc = options.callback;
        } else {
            callbackDataSrc = (json) => {
                const result = [];
                for (const data of json.data) {
                    let item = {};
                    for (const bindKey of Object.keys(columnsBinds)) {
                        const optionsItem = columnsBinds[bindKey];
                        let value = '';
                        if (optionsItem.itemText) {
                            try {
                                value = optionsItem.itemText;
                                let matchesReplaces = optionsItem.itemText.match(/\{\$.*?\}/gi);
                                if (matchesReplaces && matchesReplaces.length) {
                                    matchesReplaces.forEach(element => {
                                        let evalValue = element.replace(/^\{\$|\}/gi, '');
                                        eval(`evalValue = ${evalValue}`);
                                        evalValue = window.utils.valueStringNullToEmptyString(evalValue);
                                        value = value.replace(element, evalValue);
                                    });
                                }

                            } catch (e) {
                                //ignore catch-error
                            }
                        } else {
                            value = data[bindKey];

                            switch (optionsItem.itemType) {
                                case 'date':
                                    value = window.utils.jsonDateStringToFormat(value);
                                    break;
                                case 'datetime':
                                    value = window.utils.jsonDateTimeStringToFormat(value);
                                    break;
                                case 'money':
                                    value = window.utils.numberToMoney(value)
                                    break;
                            }
                            //parse tipos valores corretos ? tipo date para dd/mm/yyyy
                        }

                        item[bindKey] = value;

                    }
                    result.push(item);
                }
                return result;
            }
        }

        let checkUrl = tableJQuery.attr('data-url-view')
        if (checkUrl) {
            options.actions.push({ href: checkUrl, type: 'VIEW' });
        }

        checkUrl = tableJQuery.attr('data-url-edit')
        if (checkUrl) {
            options.actions.push({ href: checkUrl, type: 'EDIT' });
        }

        checkUrl = tableJQuery.attr('data-url-delete')
        if (checkUrl) {
            options.actions.push({ onclick: `__dataTableTemplaterConfirm('${checkUrl}')`, type: 'DELETE' });
        }

        ajax.dataSrc = (json) => {
            optionsDatatable.dados = json.data;
            let result = callbackDataSrc(json);

            if (hasActions) {
                result = result.map(i => {
                    if (hasKey) {
                        i.key = i[keyColumn];
                    }
                    if (!i.hasOwnProperty('__actions')) {
                        let actionParsedButtons = parseActionsDataTableItem(i, options.actions);
                        if (!window.DataTableTemplaterConfigs.actionDivGroup)
                            i.__actions = actionParsedButtons;
                        else
                            i.__actions = `<div class="btn-group" role="group">${actionParsedButtons}</div>`;
                    }
                    return i;
                });
            }
            return result;
        };

        optionsDatatable.lengthMenu = [[10, 25, 50, 100], [10, 25, 50, 100]];
        optionsDatatable.language = window.DataTableTemplaterConfigs.language;
        optionsDatatable.processing = true;
        return tableJQuery.DataTable(optionsDatatable);
    }

    const utils = {
        /**
         * Formata DateString para DD/MM/YYYY
         * @param {string} value 
         */
        jsonDateStringToFormat: function (value) {
            if (!value)
                return value;
            return moment(value).format("DD/MM/YYYY");
        },
        /**
         * Formata string datetime recebida em JSON para dd/MM/yyyy HH:mm:ss 
         * @param {string} value
         */
        jsonDateTimeStringToFormat: function (value) {
            if (!value)
                return value;
            return moment(value).format("DD/MM/YYYY HH:mm:ss");
        },
        /**
         * Formata valores para string
         * @param {number} value 
         * @param {string} locale 
         */
        numberToMoney: (value) => {
            if (value === undefined || value === null)
                return value;
            return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        },

        valueStringNullToEmptyString: (value) => {
            return ((typeof value === 'string' && !value) || (value === null || value === undefined)) ? '' : value;
        }
    }

    window.utils = utils;

    if (!window.window.DataTableTemplaterConfigs) {
        window.DataTableTemplaterConfigs = {
            globalConfirm: null
        };
    }

    if (!window.DataTableTemplaterConfigs.language) {
        window.DataTableTemplaterConfigs.language = { sEmptyTable: "Nenhum registro encontrado", sInfo: "Mostrando de _START_ até _END_ de _TOTAL_ registros", sInfoEmpty: "Mostrando 0 até 0 de 0 registros", sInfoFiltered: "(Filtrados de _MAX_ registros)", sInfoPostFix: "", sInfoThousands: ".", sLengthMenu: "_MENU_ resultados por página", sLoadingRecords: "Carregando...", sProcessing: "Processando...", sZeroRecords: "Nenhum registro encontrado", sSearch: "Pesquisar", oPaginate: { sNext: "Próximo", sPrevious: "Anterior", sFirst: "Primeiro", sLast: "Último" }, oAria: { sSortAscending: ": Ordenar colunas de forma ascendente", sSortDescending: ": Ordenar colunas de forma descendente" }, select: { rows: { _: "Selecionado %d linhas", 0: "Nenhuma linha selecionada", 1: "Selecionado 1 linha" } }, buttons: { copy: "Copiar para a área de transferência", copyTitle: "Cópia bem sucedida", copySuccess: { 1: "Uma linha copiada com sucesso", _: "%d linhas copiadas com sucesso" } } };
    }

    if (window.DataTableTemplaterConfigs.actionDivGroup === undefined) {
        window.DataTableTemplaterConfigs.actionDivGroup = true;
    }

    if (!window.DataTableTemplaterConfigs.editLabel) {
        window.DataTableTemplaterConfigs.editLabel = 'Editar';
    }

    if (!window.DataTableTemplaterConfigs.editClass) {
        window.DataTableTemplaterConfigs.editClass = 'btn btn-secondary';
    }

    if (!window.DataTableTemplaterConfigs.deleteLabel) {
        window.DataTableTemplaterConfigs.deleteLabel = 'Deletar';
    }

    if (!window.DataTableTemplaterConfigs.deleteClass) {
        window.DataTableTemplaterConfigs.deleteClass = 'btn btn-danger';
    }

    if (!window.DataTableTemplaterConfigs.viewLabel) {
        window.DataTableTemplaterConfigs.viewLabel = 'Visualizar';
    }

    if (!window.DataTableTemplaterConfigs.viewClass) {
        window.DataTableTemplaterConfigs.viewClass = 'btn btn-info';
    }

    window.__dataTableTemplaterConfirm = (url) => {
        if (!window.DataTableTemplaterConfigs.globalConfirm) {
            window.location = url;
            return;
        }
        window.DataTableTemplaterConfigs.globalConfirm(url);
    }

    window.atualizarDataTable = function (dataTable) {
        if (!dataTable) {
            return;
        }

        dataTable.ajax.reload();
    }

    window.factoryDataTableFromHtml = factoryDataTableFromHtml.bind(this);
})();