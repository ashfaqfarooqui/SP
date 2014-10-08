'use strict';

/**
 * @ngdoc directive
 * @name spGuiApp.directive:itemTable
 * @description
 * # itemTable
 */
angular.module('spGuiApp')
  .directive('itemTable', function (itemListSvc, spTalker, RecursionHelper, ITEM_KINDS, SV_KINDS) {
    return {
      templateUrl: 'views/itemtable.html',
      restrict: 'E',
      scope: {
        parentItem: '=',
        servedItems: '=',
        alterCheckedArray: '=',
        selection: '=',
        attrSelection: '=',
        addWindow: '=',
        itemListScope: '='
      },
      controller: function($scope) {
        $scope.itemListSvc = itemListSvc;
        $scope.items = [];
        $scope.spTalker = spTalker;
        $scope.itemKinds = ITEM_KINDS;
        $scope.svKinds = SV_KINDS;

        $scope.addItemExpandListener = function(item, row) {
          $scope.$on('show-info-' + item.id, function() {
            row.infoIsCollapsed = false;
            row.edit = true;
          });
          $scope.$on('show-children-' + item.id, function() {
            itemListSvc.expandChildren(row, false);
          });
        };

        $scope.$on('itemsQueried', function() {
          itemListSvc.getChildren($scope.parentItem, $scope.items);
        });

        if(typeof $scope.servedItems === 'undefined') {
          itemListSvc.getChildren($scope.parentItem, $scope.items);
        } else {
          $scope.items = $scope.servedItems;
        }

        $scope.filterKey = function(key){
          return key !== 'id' && key !=='name' && key !== 'isa' && key !== 'version' && key !== 'attributes'
        };

        $scope.isAttributesEmpty = function(item) {
          return _.isEmpty(item.attributes)
        };

        $scope.objectify = function(key, value) {
            var obj = {};
            obj[key] = value;
            return obj
        }

      },
      compile: function(element) {
        return RecursionHelper.compile(element);
      }
    };
  });