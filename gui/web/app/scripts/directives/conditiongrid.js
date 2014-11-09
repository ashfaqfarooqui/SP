'use strict';

/**
 * @ngdoc directive
 * @name spGuiApp.directive:conditionGrid
 * @description
 * # conditionGrid
 */
angular.module('spGuiApp')
  .directive('conditionGrid', function (RecursionHelper, spTalker) {
    return {
      templateUrl: 'views/conditiongrid.html',
      restrict: 'E',
      scope: {
        parent: '=',
        key: '=',
        parentOperator: '='
      },
      controller: function($scope) {
        $scope.operators = function(parentOp) {
          if(parentOp === 'EQ')
            return ['id', 'value'];
          else
            return ['AND', 'OR', 'EQ']
        };

        $scope.sides = ['left', 'right'];
        $scope.spTalker = spTalker;
        $scope.row = {
          type: 'value'
        };

        $scope.isDefined = function(ref) {
          return angular.isDefined(ref);
        };

        $scope.$watch(function() {
            return $scope.parent[$scope.key];
          }, function() {
            $scope.row.type = $scope.getType($scope.parent, $scope.key);
          });

        $scope.addProp = function(array) {
          array.push({isa: 'EQ', left: {id: ''}, right: 3});
        };

        $scope.removeProp = function(array, index) {
          array.splice(index, 1);
        };

        $scope.getType = function(parent, key) {
          if(angular.isDefined(parent[key]) && angular.isDefined(parent[key].isa))
            return parent[key].isa;
          else if(angular.isDefined(parent[key]) && angular.isDefined(parent[key].id))
            return 'id';
          else
            return 'value';
        };

        $scope.changeType = function(parent, key, type) {
          if(type === 'value')
            parent[key] = 'value';
          else if(type === 'id')
            parent[key] = { id: ''};
          else if(type === 'EQ' || type === 'NEQ') {
            if(parent[key].isa === 'EQ' || parent[key].isa === 'NEQ') {
              parent[key].isa = type;
            } else {
              parent[key] = {
                isa: type,
                left: {id: ''},
                right: 'true'
              };
            }
          } else { // AND, OR
            if(parent[key].isa === 'AND' || parent[key].isa === 'OR') {
              parent[key].isa = type;
            } else {
              parent[key] = {
                isa: type,
                props: [{isa: 'EQ', left: {id: ''}, right: 2}, {isa: 'EQ', left: {id: ''}, right: 3}]
              };
            }
          }

          $scope.$broadcast('typeChanged');
        };

      },
      compile: function(element) {
        // Use the compile function from the RecursionHelper,
        // And return the linking function(s) which it returns

        return RecursionHelper.compile(element);
      }
    };
  });
