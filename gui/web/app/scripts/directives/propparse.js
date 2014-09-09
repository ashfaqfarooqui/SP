'use strict';

/**
 * @ngdoc directive
 * @name spGuiApp.directive:propParse
 * @description
 * # propParse
 */
angular.module('spGuiApp')
  .directive('propParse', function (spTalker) {
    return {
      require: 'ngModel',
      link: function postLink(scope, element, attrs, ngModel) {
        var thingAndStateVarMatchExp = /([\w]*\.[\w]*)/gi,
          thingMatchExp = /([\w]*)\./i,
          stateVarMatchExp = /\.([\w]*)/i,
          guardOrAction = scope.guardOrAction;

        function namesToId(viewValue) {
          var internalCopy = angular.copy(viewValue),
            valid = true;

          internalCopy = internalCopy.replace(thingAndStateVarMatchExp, function (thingAndStateVarString) {
            var thingString = thingMatchExp.exec(thingAndStateVarString)[1],
              stateVarString = stateVarMatchExp.exec(thingAndStateVarString)[1];
            var thing = spTalker.thingsByName[thingString.toLowerCase()];
            if (typeof thing !== 'undefined') {
              if(typeof stateVarString !== 'undefined') {
                var stateVar = thing.stateVariables.filter(function (aStateVar) {
                  return aStateVar.name.toLowerCase() === stateVarString.toLowerCase();
                })[0];
                if (typeof stateVar !== 'undefined') {
                  return stateVar.id;
                } else {
                  valid = false;
                }
              } else {
                valid = false;
              }
            } else {
              valid = false;
            }
            return '';
          });

          if(valid) {
            ngModel.$setValidity('nameToIds',true);
          } else {
            ngModel.$setValidity('nameToIds',false);
          }

          if(guardOrAction === 'guard') {
            parseTextAsProp(internalCopy);
          } else {
            parseTextAsAction(internalCopy);
          }

          return viewValue;
        }

        function parseTextAsAction(viewValue) {
          var words = viewValue.split(' '),
            valid = true, actions = [];
          for(var i = 0; i < words.length; i++) {
            var action = {};
            if(typeof words[i] === 'string' && words[i] !== '=') {
              action.stateVariableID = words[i];
            } else {
              valid = false;
              break;
            }
            i++;
            if(typeof words[i] !== 'string' || words[i] !== '=') {
              valid = false;
              break;
            }
            i++;
            if(typeof words[i] === 'string' && words[i] !== '=' && words[i].length > 0) {
              action.value = words[i].replace(',', '');
            } else {
              valid = false;
              break;
            }
            actions.push(action);
          }
          if(valid) {
            ngModel.$setValidity('actionParse', true);
            scope.condition.action = actions;
          } else {
            ngModel.$setValidity('actionParse', false);
          }
        }

        function parseTextAsProp(viewValue){
          spTalker.parseProposition(viewValue)
            .success(function (data) {
              if(typeof data === 'string' && viewValue !== '') {
                ngModel.$setValidity('propParse',false);
              } else {
                if(typeof viewValue === 'undefined' || viewValue === '') {
                  scope.condition['guard'] = {isa:'EQ', right: true, left: true}; // work-around to enable save of ops as long as backend doesn't accept anything else
                } else {
                  scope.condition['guard'] = data;
                }
                ngModel.$setValidity('propParse',true);
              }
            })
            .error(function (data, status, headers, config) {
              ngModel.$setValidity('propParse',false);
            });
          return viewValue;
        }

        //For DOM -> model validation
        ngModel.$parsers.unshift(namesToId);


        function propFormatter(viewValue) {
          if(scope.condition.hasOwnProperty('guard')) {
            var data = scope.condition['guard'];
            return propToText(data);
          }
          return '';
        }

        function getThingAndStateVarAsStringFromId(idSearchedFor) {
          var matchingThingName = false, matchingStateVarName = '';
          for(var id in spTalker.things) {
            if(matchingThingName) {
              break;
            }
            if(spTalker.things.hasOwnProperty(id)) {
              spTalker.things[id].stateVariables.forEach(function(stateVariable) {
                if(stateVariable.id === idSearchedFor) {
                  matchingStateVarName = stateVariable.name;
                  matchingThingName = spTalker.things[id].name;
                }
              })
            }
          }
          return matchingThingName + '.' + matchingStateVarName;
        }

        function handleProp(prop) {
          if(prop.hasOwnProperty('id')) {
            return getThingAndStateVarAsStringFromId(prop.id);
          } else if(prop.hasOwnProperty('isa')) {
            return '(' + propToText(prop) + ')';
          } else {
            return prop;
          }
        }

        function propToText(prop) {
          var operator;
          if(prop.isa === 'EQ' || prop.isa === 'NEQ') {
            var left = handleProp(prop.left),
              right = handleProp(prop.right);
            if(prop.isa === 'EQ') {
              operator = ' == ';
            } else {
              operator = ' != ';
            }
            return left + operator + right;
          } else if(prop.isa === 'AND' || prop.isa === 'OR') {
            operator = ' ' + prop.isa + ' ';
            var line = '';
            for(var i = 0; i < prop.props.length; i++) {
              if(i > 0) {
                line = line + operator;
              }
              line = line + handleProp(prop.props[i]);
            }
            return line;
          } else if(prop.isa === 'NOT') {
            return '!' + handleProp(prop.p);
          } else {
            return '';
          }
        }

        function actionFormatter(viewValue) {
          var actions = scope.condition.action,
            textLine = '';

          for(var i = 0; i < actions.length; i++) {
            if(i > 0) {
              textLine = textLine + '; ';
            }
            textLine = textLine + getThingAndStateVarAsStringFromId(actions[i].stateVariableID) + ' = ' + actions[i].value;
          }
          return textLine;
        }

        //For model -> DOM validation
        if(scope.guardOrAction === 'guard') {
          ngModel.$formatters.unshift(propFormatter);
        } else {
          ngModel.$formatters.unshift(actionFormatter);
        }

      }
    };
  });
