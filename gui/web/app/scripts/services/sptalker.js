'use strict';

/**
 * @ngdoc service
 * @name spGuiApp.spTalker
 * @description
 * # spTalker
 * Factory in the spGuiApp.
 */
angular.module('spGuiApp')
.factory('spTalker', ['$rootScope', '$resource', '$http', 'notificationService', '$timeout', function ($rootScope, $resource, $http, notificationService, $timeout) {
  var apiUrl = '/api',
    factory = {
      activeModel: {},
      models: {},
      users: [],
      operations: [],
      items: {},
      itemsRead: false,
      spSpecs: {},
      things: {},
      thingsAndOpsByName: {},
      item : $resource(apiUrl + '/models/:model/items/:id', { model: '@model', id: '@id'}),
      model: $resource(apiUrl + '/models/:model', { model: '@model' }),
      user: $resource(apiUrl + '/users', {}),
      operation: $resource(apiUrl + '/models/:model/operations', { model: '@model' }, {saveArray: {method: 'POST', isArray: true}}),
      thing: $resource(apiUrl + '/models/:model/things/:thing', { model: '@model', thing: '@thing' })
    };

  if(sessionStorage.activeModel) {
    factory.activeModel = { loading: 'please wait' };
    var model = angular.fromJson(sessionStorage.activeModel);
    factory.model.get({model: model.model}, function(model) {
      factory.activeModel = model;
      factory.loadAll();
    }, function(error) {
      console.log(error);
    });
  }

  factory.getItemById = function(id) {
    return factory.items[id];
  };

  factory.getItemName = function(id) {
    var item =  factory.items[id];
    return item.name
  };

  //TODO: Handle services in a general way. Retrieve possible services from server
  factory.parseProposition = function(proposition) {
    return $http({
      method: 'POST',
      url: 'api/services/PropositionParser',
      data: {
        model: factory.activeModel.model,
        parse: proposition
      }})
  };

  factory.findRelations = function(ops, initState) {
    return $http({
      method: 'POST',
      url: 'api/services/Relations',
      data: {
        model: factory.activeModel.model,
        operations: ops,
        initstate: initState
      }})
  };

  factory.getSOP = function(ops, base) {
    return $http({
      method: 'POST',
      url: 'api/services/SOPMaker',
      data: {
        model: factory.activeModel.model,
        operations: ops,
        base: base
      }})
  };

  factory.loadModels = function() {
    factory.model.query(function(models) {
      models.forEach(function(model) {
        factory.models[model.model] = model;
      });
    });
  };
  factory.loadModels();

  function emptyMaps(mapsToEmpty) {
    for(var i = 0; i < mapsToEmpty.length; i++) {
      for(var itemID in mapsToEmpty[i]) {
        if (mapsToEmpty[i].hasOwnProperty(itemID)) {
          delete mapsToEmpty[i][itemID];
        }
      }
    }
  }

  function filterOutItems() {
    emptyMaps([factory.things, factory.thingsAndOpsByName, factory.spSpecs]);

    for(var id in factory.items) {
      if (factory.items.hasOwnProperty(id)) {
        if(factory.items[id].isa === 'Thing' || factory.items[id].isa === 'Operation') {
          factory.thingsAndOpsByName[factory.items[id].name.toLowerCase()] = factory.items[id];
          if(factory.items[id].isa === 'Thing') {
            factory.things[id] = factory.items[id];
          }
        } else if(factory.items[id].isa === 'SPSpec') {
          factory.spSpecs[id] = factory.items[id];
        }
      }
    }

  }

  function updateItemLists() {
    filterOutItems();
  }

  factory.loadAll = function() {
    factory.loadModels();
    factory.item.query({model: factory.activeModel.model}, function(items) {
      Object.keys(factory.items).forEach(function(id) {
        delete factory.items[id];
      });
      items.forEach(function(item) {
        factory.items[item.id] = item;
      });
      updateItemLists();
      $timeout(function() {
        $rootScope.$broadcast('itemsQueried');
      });
      factory.itemsRead = true;
    });
  };

  factory.saveItems = function(items, notifySuccess, successHandler) {
    var success = true,
      itemsArray = [];
    if(items instanceof Array) {
      if(itemsArray.length === 0) {
        notificationService.error('No items supplied to save.');
        return false;
      }
      itemsArray = items;
    } else {
      for(var id in items) {
        if(items.hasOwnProperty(id)) {
          itemsArray.push(items[id]);
        }
      }
    }
    if(Object.keys(factory.activeModel).length === 0) {
      notificationService.error('No active model chosen.');
      return false;
    }
    $http({method: 'POST', url: 'api/models/' + factory.activeModel.model + '/items', data: itemsArray})
      .success(function(data) {
        data.forEach( function(itemData) {
          var item = factory.getItemById(itemData.id);
          angular.copy(itemData, item);
        });
        if(notifySuccess) {
          notificationService.success(itemsArray.length + ' items were successfully saved.');
        }
        updateItemLists();
        if(successHandler) {
          successHandler(data);
        }
      })
      .error(function(data) {
        console.log(data);
        notificationService.error('Items save failed. Please see console log for details.');
        success = false;
      });
    return success;
  };

  factory.saveItem = function(item, showSuccessNotifications, successHandler) {
    var success = true;
    if(Object.keys(factory.activeModel).length === 0) {
      notificationService.error('No active model chosen.');
      return
    }
    if(typeof item === 'undefined' || Object.keys(item).length === 0) {
      notificationService.error('No item chosen.');
      return
    }
    item.$save(
      {model: factory.activeModel.model, id: item.id},
      function (data) {
        if(showSuccessNotifications) {
          notificationService.success(item.isa + ' \"' + item.name + '\" was successfully saved');
        }
        updateItemLists();
        if(successHandler) {
          successHandler(data);
        }

      },
      function (error) {
        notificationService.error(item.isa + ' ' + item.name + ' could not be saved.');
        console.log(error);
        success = false;
      }
    );
    return success;
  };

  factory.svKindChange = function(sv, newItem) {
    var kind = sv.kind;
    delete sv.domain;
    delete sv.range;
    delete sv.boolean;
    delete sv.init;
    delete sv.goal;

    function addSVKindAttributes() {
      if(kind === 'domain') {
        sv[kind] = ['home', 'flexlink'];
        sv.init = 'home';
        sv.goal = 'flexlink';
      } else if(kind === 'range') {
        sv[kind] = {
          start: 0,
          end: 2,
          step: 1
        };
        sv.init = 0;
        sv.goal = 2
      } else if(kind === 'boolean') {
        sv[kind] = true;
        sv.init = false;
        sv.goal = true;
      }
    }

    if(newItem) {
      addSVKindAttributes();
    } else {
      $timeout(function() {
        addSVKindAttributes();
      });
    }

  };

  factory.createItem = function(type, successHandler, readyMadeItem, errorHandler, parent) {
    var newItem;
    if(typeof readyMadeItem === 'undefined' || !readyMadeItem) {
      newItem = new factory.item({
        isa : type,
        name : type + Math.floor(Math.random()*1000),
        attributes : {
          children: [],
          parent: parent.id
        }
      });
      if(type === 'Operation') {
        newItem.conditions = [{guard: {isa:'EQ', right: true, left: true}, action: [], attributes: {kind: 'pre', group: ''}}];
      } else if(type === 'Thing') {
        newItem.attributes.stateVariable =  {
          kind: 'range'
        };
        factory.svKindChange(newItem.attributes.stateVariable, true);
      } else if(type === 'SOPSpec') {
        newItem.sop = [{
          isa: 'Sequence',
          sop: []
        }];
      }
    } else {
      newItem = readyMadeItem;
    }

    newItem.$save(
      {model:factory.activeModel.model},
      function(data) {
        factory.items[data.id] = data;
        notificationService.success('A new ' + data.isa + ' with name ' + data.name + ' was successfully created.');
        updateItemLists();
        if(successHandler) {
          successHandler(data);
        } else {
          $rootScope.$broadcast('itemsQueried');
        }
      },
      function(error) {
        console.log(error);
        notificationService.error('Creation of ' + newItem.isa + ' failed. Check your browser\'s console for details.');
        if(errorHandler) {
          errorHandler(error);
        }
      }
    );
  };

  factory.deleteItem = function(itemToDelete, notifySuccess) {
    var success = true;

    removeItemFromServer();

    function removeItemFromServer() {
      itemToDelete.$delete(
        {model:factory.activeModel.model},
        function(data) {
          //delete factory.items[data.id];
          if(notifySuccess) {
            notificationService.success(data.isa + ' ' + data.name + ' was successfully deleted.');
          }
          //$rootScope.$broadcast('itemsQueried');
          factory.loadAll();
        },
        function(error) {
          console.log(error);
          notificationService.error(itemToDelete.isa + ' ' + itemToDelete.name + ' could not be deleted from the server. Check your browser\'s error console for details.');
          success = false;
        }
      );
    }

    return success;
  };

  factory.reReadFromServer = function(item) {
    item.$get({model: factory.activeModel.model}, function() {
      $rootScope.$broadcast('itemsQueried');
    });
  };

  /*$http.defaults.headers.common['Authorization'] = 'Basic ' + window.btoa('admin' + ':' + 'pass');
  $http({method: 'GET', url: 'api/secured'}).
    success(function(data, status, headers, config) {
        console.log(data);
        // this callback will be called asynchronously
        // when the response is available
    }).
    error(function(data, status, headers, config) {
        console.log(data);
        // called asynchronously if an error occurs
        // or server returns response with an error status.
    });*/

    /*$http({method: 'POST', url: 'api/users', data: {userName: 'test', password: 'demo', name: 'Ben'}}).
        success(function(data, status, headers, config) {
            console.log(data);
            // this callback will be called asynchronously
            // when the response is available
        }).
        error(function(data, status, headers, config) {
            console.log(data);
            // called asynchronously if an error occurs
            // or server returns response with an error status.
        });

    $http({method: 'GET', url: 'api/users'}).
        success(function(data, status, headers, config) {
            console.log(data);
            // this callback will be called asynchronously
            // when the response is available
        }).
        error(function(data, status, headers, config) {
            console.log(data);
            // called asynchronously if an error occurs
            // or server returns response with an error status.
        });*/



  return factory;

}]);