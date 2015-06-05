'use strict';

/**
 * @ngdoc service
 * @name spGuiApp.sopDrawer
 * @description
 * # sopDrawer
 * Factory in the spGuiApp.
 */
angular.module('spGuiApp')
  .factory('sopDrawer', [ 'sopCalcer', 'spTalker', function (sopCalcer, spTalker) {

    var factory = {}, measures, dragDropManager = {
        'draggedObj' : false,
        'droppable' : false,
        'objToInsertInArray' : [],
        'objToInsertIn' : 0,
        'indexToInsertAt' : 0
    };

    factory.calcAndDrawSop = function(dirScope, paper, firstLoop, doRedraw) {
      measures = {
          'margin' : 15,
          'opH' : 50,
          'opW' : 60,
          'para' : 7,
          'arrow' : 5,
          'textScale': 6,
          'animTime': 300,
          'commonLineColor': 'white',
          'condLineHeight': 12,
          'nameLineHeight': 50
      };

      dirScope.sopSpecCopy.sop.forEach(function(sequence) {
        unregisterDrawings(sequence, true);
      });

      sopCalcer.makeIt(dirScope, measures);

      dirScope.sopSpecCopy.sop.forEach(function(sequence) {
        factory.drawSop(sequence, measures, paper, firstLoop, doRedraw, dirScope, sequence);
      });
    };

    function unregisterDrawings(struct, justLines) {
      if(typeof struct.clientSideAdditions !== 'undefined') {

        if(typeof struct.clientSideAdditions.lines !== 'undefined') {
          struct.clientSideAdditions.lines.forEach(function(line) {
            if (typeof line.drawnLine !== 'undefined') {
              line.drawnLine.remove();
            }
            if (typeof line.drawnShadow !== 'undefined') {
              line.drawnShadow.remove();
            }
          });
          struct.clientSideAdditions.lines = [];
        }

        if(!justLines) {
          for(var propertyName in struct.clientSideAdditions) {
            if(struct.clientSideAdditions.hasOwnProperty(propertyName)) {
              if (struct.clientSideAdditions[propertyName].hasOwnProperty('type')) {
                struct.clientSideAdditions[propertyName].remove();
              }
            }
          }
        }
      }

      console.log("SOP:")
      console.log(struct)

      for(var i = 0; i < struct.sop.length; i++) {
        unregisterDrawings(struct.sop[i], justLines);
      }
    }

    function drawConditions(struct, array, string, ystart, paper, measures) {
      struct.clientSideAdditions[string] = [];
      for(var j = 0; j < array.length; j++) {
        var condition = paper.text(struct.clientSideAdditions.width / 2, ystart + measures.condLineHeight*j, array[j]);
        struct.clientSideAdditions[string].push(condition);
        struct.clientSideAdditions.drawnSet.push(condition);
        struct.clientSideAdditions.setToDrag.push(condition);
        condition.toFront();
      }
      return j;
    }

    factory.drawSop = function (struct, measures, paper, firstLoop, doRedraw, dirScope, sequence) {
      var animTime = measures.animTime;
      
      for (var n = 0; n < struct.sop.length; n++) {
        factory.drawSop(struct.sop[n], measures, paper, false, doRedraw, dirScope, sequence);
        if(struct.isa === 'Sequence') {
          factory.drawLine(struct.clientSideAdditions.lines[n], measures, paper, struct, n+1, 'red', dirScope); // Line after each op in sequence
        } else {
          factory.drawLine(struct.clientSideAdditions.lines[n], measures, paper, struct.sop[n], 0, 'yellow', dirScope); // Line above each struct
          factory.drawLine(struct.clientSideAdditions.lines2[n], measures, paper, struct.sop[struct.clientSideAdditions.lines2[n].subSopIndex], 'last', 'blue', dirScope); // Line after each struct
        }
      }
      
      if(typeof struct.clientSideAdditions.drawn === 'undefined' || doRedraw) {
        struct.clientSideAdditions.drawnSet = paper.set();
        struct.clientSideAdditions.drawnShadowSet = paper.set();
        struct.clientSideAdditions.moved = 0;
        
        // Draw struct
        if (struct.isa === 'Hierarchy') {
          struct.clientSideAdditions.setToDrag = paper.set();
          var op = spTalker.getItemById(struct.operation);

          struct.clientSideAdditions.drawnText = paper.text(struct.clientSideAdditions.width / 2, (struct.clientSideAdditions.preGuards.length + struct.clientSideAdditions.preActions.length + 1) * measures.condLineHeight + (measures.nameLineHeight-measures.condLineHeight) / 2, op.name).attr({'font-weight': 'bold'});
          struct.clientSideAdditions.drawnRect = paper.rect(0, 0, struct.clientSideAdditions.width, struct.clientSideAdditions.height, 5).attr({fill:'#FFFFFF', 'stroke-width':0, text: struct.clientSideAdditions.drawnText});

          if(dirScope.windowStorage.editable) {
            var opContextMenu = {
              target: '#op-context-menu',
              onItem: function (context, e) {
                if (e.target.getAttribute('id') === 'remove-op') {
                  factory.removeNode(struct, false);
                  factory.calcAndDrawSop(dirScope, paper, true, false, true);
                  dirScope.$digest();
                } else if (e.target.getAttribute('id') === 'remove-sequence') {
                  unregisterDrawings(sequence, false);
                  dirScope.sopSpecCopy.sop.splice(dirScope.sopSpecCopy.sop.indexOf(sequence), 1);
                  factory.calcAndDrawSop(dirScope, paper, true, false, true);
                  dirScope.$digest();
                }
                e.preventDefault();
              }
            };
            angular.element(struct.clientSideAdditions.drawnRect.node).contextmenu(opContextMenu);
            angular.element(struct.clientSideAdditions.drawnText.node).contextmenu(opContextMenu);
          }

          struct.clientSideAdditions.drawnArrow = paper.path(struct.clientSideAdditions.arrow).attr({opacity:0, 'fill':measures.commonLineColor, 'stroke-width':0}).toBack();
          var arrowAnim = Raphael.animation({opacity:1}, 0);
          struct.clientSideAdditions.drawnArrow.animate(arrowAnim.delay(animTime));

          struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnRect, struct.clientSideAdditions.drawnText, struct.clientSideAdditions.drawnArrow);
          struct.clientSideAdditions.setToDrag.push(struct.clientSideAdditions.drawnRect, struct.clientSideAdditions.drawnText);

          struct.clientSideAdditions.setToDrag.toFront();

          var preGuardYPos = measures.condLineHeight,
            preActionYPos = preGuardYPos + struct.clientSideAdditions.preGuards.length * measures.condLineHeight,
            preLineYPos = preActionYPos + struct.clientSideAdditions.preActions.length * measures.condLineHeight,
            postGuardYPos = preLineYPos + measures.nameLineHeight,
            postLineYPos = postGuardYPos - measures.condLineHeight,
            postActionYPos = postGuardYPos + struct.clientSideAdditions.postGuards.length * measures.condLineHeight;

          drawConditions(struct, struct.clientSideAdditions.preGuards, 'drawnPreGuards', preGuardYPos, paper, measures);
          drawConditions(struct, struct.clientSideAdditions.preActions, 'drawnPreActions', preActionYPos, paper, measures);
          drawConditions(struct, struct.clientSideAdditions.postGuards, 'drawnPostGuards', postGuardYPos, paper, measures);
          drawConditions(struct, struct.clientSideAdditions.postActions, 'drawnPostActions', postActionYPos, paper, measures);

          struct.clientSideAdditions.drawnPreLine = paper.path('M0,' + preLineYPos + ' l' + struct.clientSideAdditions.width + ',0');
          struct.clientSideAdditions.drawnPostLine = paper.path('M0,' + postLineYPos + ' l' + struct.clientSideAdditions.width + ',0');
          struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnPreLine, struct.clientSideAdditions.drawnPostLine);
          struct.clientSideAdditions.setToDrag.push(struct.clientSideAdditions.drawnPreLine, struct.clientSideAdditions.drawnPostLine);

          if(dirScope.windowStorage.editable) {
            factory.makeDraggable(struct.clientSideAdditions.setToDrag, struct.clientSideAdditions.x, struct.clientSideAdditions.y, struct, paper, dirScope, measures);
          }

          struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnShadowSet);
          struct.clientSideAdditions.drawnSet.animate({transform:'T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y}, animTime);
          
        } else {
          if (struct.isa === 'Other') {
            struct.clientSideAdditions.drawnRect = paper.rect(0, 0, struct.clientSideAdditions.structMeasures.width, struct.clientSideAdditions.structMeasures.height).attr({'fill': '#D8D8D8', 'fill-opacity': 0.5, 'stroke': measures.commonLineColor, 'stroke-width': 0, 'rx': 10, 'ry': 10}).toBack();
            struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnRect);
            if(dirScope.windowStorage.editable) {
              factory.makeDroppable(struct.drawnSet, false, struct, 0, false, dirScope, paper, measures);
            }
          } else if (struct.isa === 'Alternative') {
            if(dirScope.sopSpecCopy.vertDir) {
              struct.clientSideAdditions.drawnShadow = paper.rect(struct.clientSideAdditions.structMeasures.x11, struct.clientSideAdditions.structMeasures.y11, struct.clientSideAdditions.structMeasures.x12, struct.clientSideAdditions.structMeasures.y21).attr({fill: '#FF0000', opacity: 0}).toBack();
            } else {
              struct.clientSideAdditions.drawnShadow = paper.rect(struct.clientSideAdditions.structMeasures.x11, struct.clientSideAdditions.structMeasures.y11, struct.clientSideAdditions.structMeasures.x21, struct.clientSideAdditions.structMeasures.y22).attr({fill: '#FF0000', opacity: 0}).toBack();
            }
            struct.clientSideAdditions.drawnShadowSet.push(struct.clientSideAdditions.drawnShadow);
            struct.clientSideAdditions.drawnLine1 = paper.path('M ' + struct.clientSideAdditions.structMeasures.x11 + ' ' + struct.clientSideAdditions.structMeasures.y11 + ' l ' + struct.clientSideAdditions.structMeasures.x12 + ' ' + struct.clientSideAdditions.structMeasures.y12).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnLine2 = paper.path('M ' + struct.clientSideAdditions.structMeasures.x21 + ' ' + struct.clientSideAdditions.structMeasures.y21 + ' l ' + struct.clientSideAdditions.structMeasures.x22 + ' ' + struct.clientSideAdditions.structMeasures.y22).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnLine1, struct.clientSideAdditions.drawnLine2);

            if(dirScope.windowStorage.editable) {
              factory.makeDroppable(struct.clientSideAdditions.drawnShadowSet, true, struct, 0, false, dirScope, paper, measures);
            }
          } else if (struct.isa === 'Parallel' || struct.isa === 'Arbitrary') {
            if(dirScope.sopSpecCopy.vertDir) {
              struct.clientSideAdditions.drawnShadow = paper.rect(0, 0, struct.clientSideAdditions.structMeasures.width, struct.clientSideAdditions.structMeasures.y41).attr({fill: '#FF0000', opacity: 0}).toBack();
            } else {
              struct.clientSideAdditions.drawnShadow = paper.rect(0, 0, struct.clientSideAdditions.structMeasures.x41, struct.clientSideAdditions.structMeasures.height).attr({fill: '#FF0000', opacity: 0}).toBack();
            }
            struct.clientSideAdditions.drawnShadowSet.push(struct.clientSideAdditions.drawnShadow);
            struct.clientSideAdditions.drawnLine1 = paper.path('M 0 0 l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnLine2 = paper.path('M ' + struct.clientSideAdditions.structMeasures.x21 + ' ' + struct.clientSideAdditions.structMeasures.y21 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnLine3 = paper.path('M ' + struct.clientSideAdditions.structMeasures.x31 + ' ' + struct.clientSideAdditions.structMeasures.y31 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnLine4 = paper.path('M ' + struct.clientSideAdditions.structMeasures.x41 + ' ' + struct.clientSideAdditions.structMeasures.y41 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height).attr({'stroke': measures.commonLineColor}).toBack();
            struct.clientSideAdditions.drawnSet.push(struct.clientSideAdditions.drawnLine1, struct.clientSideAdditions.drawnLine2, struct.clientSideAdditions.drawnLine3, struct.clientSideAdditions.drawnLine4);
            if (struct.isa === 'Arbitrary') {
              struct.clientSideAdditions.drawnSet.attr({'stroke-dasharray': '- '});
            }
            if(dirScope.windowStorage.editable) {
              factory.makeDroppable(struct.clientSideAdditions.drawnShadowSet, true, struct, 0, false, dirScope, paper, measures);
            }
          }

          struct.clientSideAdditions.drawnSet.forEach(
            function(drawing) {
              drawing.attr({opacity:0});
              var structAnim = Raphael.animation({opacity:1}, 0);
              drawing.animate(structAnim.delay(animTime));
            }
          );
          struct.clientSideAdditions.drawnShadowSet.transform('T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y);
          struct.clientSideAdditions.drawnSet.transform('T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y);
        }

        dirScope.$watch(function () {
          return struct.clientSideAdditions.x + 3 * struct.clientSideAdditions.y + 5 * struct.clientSideAdditions.width + 7 * struct.clientSideAdditions.height + 9 * struct.clientSideAdditions.moved;
        }, function (newValues, oldValues) {
          if (newValues !== oldValues) {
            if (struct.isa === 'Hierarchy') {
              struct.clientSideAdditions.drawnRect.animate({width: struct.clientSideAdditions.width, height: struct.clientSideAdditions.height}, animTime);
              struct.clientSideAdditions.drawnText.animate({text: op.name}, animTime);
              var arrowAnim = Raphael.animation({opacity: 1}, 0);
              struct.clientSideAdditions.drawnArrow.animate(arrowAnim.delay(animTime));
              struct.clientSideAdditions.drawnArrow.attr({opacity: 0, path: struct.clientSideAdditions.arrow, transform: 'T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y});
              if(dirScope.windowStorage.editable) {
                factory.makeDraggable(struct.clientSideAdditions.setToDrag, struct.clientSideAdditions.x, struct.clientSideAdditions.y, struct, paper, dirScope, measures);
              }
              struct.clientSideAdditions.moved = 0;
              struct.clientSideAdditions.drawnSet.animate({transform: 'T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y}, animTime);
            } else {
              if (struct.isa === 'Other') {
                struct.clientSideAdditions.drawnRect.attr({width: struct.clientSideAdditions.structMeasures.width, height: struct.clientSideAdditions.structMeasures.height});
              } else if (struct.isa === 'Parallel' || struct.isa === 'Arbitrary') {
                if(dirScope.sopSpecCopy.vertDir) {
                  struct.clientSideAdditions.drawnShadow.attr({x: 0, y: 0, width: struct.clientSideAdditions.structMeasures.width, height: struct.clientSideAdditions.structMeasures.y41}).toBack();
                } else {
                  struct.clientSideAdditions.drawnShadow.attr({x: 0, y: 0, width: struct.clientSideAdditions.structMeasures.x41, height: struct.clientSideAdditions.structMeasures.height}).toBack();
                }
                struct.clientSideAdditions.drawnLine1.attr({path: 'M 0 0 l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height}).toBack();
                struct.clientSideAdditions.drawnLine2.attr({path: 'M ' + struct.clientSideAdditions.structMeasures.x21 + ' ' + struct.clientSideAdditions.structMeasures.y21 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height}).toBack();
                struct.clientSideAdditions.drawnLine3.attr({path: 'M ' + struct.clientSideAdditions.structMeasures.x31 + ' ' + struct.clientSideAdditions.structMeasures.y31 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height}).toBack();
                struct.clientSideAdditions.drawnLine4.attr({path: 'M ' + struct.clientSideAdditions.structMeasures.x41 + ' ' + struct.clientSideAdditions.structMeasures.y41 + ' l ' + struct.clientSideAdditions.structMeasures.width + ' ' + struct.clientSideAdditions.structMeasures.height}).toBack();
              } else if (struct.isa === 'Alternative') {
                if(dirScope.sopSpecCopy.vertDir) {
                  struct.clientSideAdditions.drawnShadow.attr({x: struct.clientSideAdditions.structMeasures.x11, y: struct.clientSideAdditions.structMeasures.y11, width: struct.clientSideAdditions.structMeasures.x12, height: struct.clientSideAdditions.structMeasures.y21}).toBack();
                } else {
                  struct.clientSideAdditions.drawnShadow.attr({x: struct.clientSideAdditions.structMeasures.x11, y: struct.clientSideAdditions.structMeasures.y11, width: struct.clientSideAdditions.structMeasures.x21, height: struct.clientSideAdditions.structMeasures.y22}).toBack();
                }
                struct.clientSideAdditions.drawnLine1.attr({path: 'M ' + struct.clientSideAdditions.structMeasures.x11 + ' ' + struct.clientSideAdditions.structMeasures.y11 + ' l ' + struct.clientSideAdditions.structMeasures.x12 + ' ' + struct.clientSideAdditions.structMeasures.y12}).toBack();
                struct.clientSideAdditions.drawnLine2.attr({path: 'M ' + struct.clientSideAdditions.structMeasures.x21 + ' ' + struct.clientSideAdditions.structMeasures.y21 + ' l ' + struct.clientSideAdditions.structMeasures.x22 + ' ' + struct.clientSideAdditions.structMeasures.y22}).toBack();
              }
              struct.clientSideAdditions.drawnSet.forEach(
                function (drawing) {
                  drawing.attr({opacity: 0});
                  var structAnim = Raphael.animation({opacity: 1}, 0);
                  drawing.animate(structAnim.delay(animTime));
                }
              );
              struct.clientSideAdditions.drawnShadowSet.attr({transform: 'T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y});
              struct.clientSideAdditions.drawnSet.attr({transform: 'T' + struct.clientSideAdditions.x + ',' + struct.clientSideAdditions.y});
            }
          }
        });

        struct.clientSideAdditions.drawn = true;
      }
      
      if(firstLoop === true) {
        factory.drawLine(struct.clientSideAdditions.lines[struct.clientSideAdditions.lines.length-1], measures, paper, struct, 0, 'purple', dirScope);
      }
      
    };

    factory.makeDroppable = function(drawnObjSet, shadow, objToInsertIn, indexToInsertAt, expectSequence, dirScope, paper, measures) {

      drawnObjSet.forEach( function(drawObj) {
        var enter = function(ev) {
            factory.highlightDroppable(drawObj);
          },
          allowdrop = function(ev) {
            ev.preventDefault();
          },
          leave = function(ev) {
            factory.removeHighlights(false);
          },
          dropped = function(ev) {
            var isa = ev.dataTransfer.getData('isa'),
              sopToInsert = {
                isa: isa,
                sop: []
              };
            if(isa === 'Hierarchy') {
              sopToInsert.operation = ev.dataTransfer.getData('id');
            }
            factory.executeDrop(sopToInsert, dirScope, paper, measures, false)
          };

        drawObj.node.addEventListener('dragenter', enter, false);
        drawObj.node.addEventListener('dragover', allowdrop, false);
        drawObj.node.addEventListener('dragleave', leave, false);
        drawObj.node.addEventListener('drop', dropped, false);
        drawObj.node.setAttribute('droppable', 'true');
        drawObj.node.setAttribute('shadow', ''+shadow);
        dragDropManager.objToInsertInArray.push(objToInsertIn);
        drawObj.node.setAttribute('objToInsertInIndex', (dragDropManager.objToInsertInArray.length-1));
        drawObj.node.setAttribute('indexToInsertAt', indexToInsertAt);
        drawObj.node.setAttribute('expectSequence', expectSequence);
      });
    };

    factory.removeNode = function(node, move) {
      node.clientSideAdditions.parentObject.sop.splice(node.clientSideAdditions.parentObjectIndex, 1); // Pop from the old position
      if(!move) {
        unregisterDrawings(node, false);

      }
    };

    factory.isMoveNecessary = function(node) {
      if(typeof node.clientSideAdditions !== 'undefined') {
        node.clientSideAdditions.moved = 1;
      } // To fire animation even if the node's coordinates are calced to the same as before

      return !(dragDropManager.objToInsertIn === node && dragDropManager.objToInsertIn.isa === 'Hierarchy' ||
        node.clientSideAdditions && dragDropManager.objToInsertIn === node.clientSideAdditions.parentObject && node.clientSideAdditions.parentObject.sop.length === 1);
        // If same target as source, return without change.

    };

    factory.insertNode = function(node, expectSequence) {
      var target;
      
      if(expectSequence === 'true' && dragDropManager.objToInsertIn.isa !== 'Sequence') {
        //console.log('Sequence expected');
        target = factory.wrapAsSequence(dragDropManager.objToInsertIn);
        dragDropManager.objToInsertIn.clientSideAdditions.parentObject.sop.splice(dragDropManager.objToInsertIn.clientSideAdditions.parentObjectIndex, 1, target);
      } else {
        target = dragDropManager.objToInsertIn;
      }

      if(typeof node.clientSideAdditions !== 'undefined' && angular.equals(dragDropManager.objToInsertIn, node.clientSideAdditions.parentObject)) { // If move within the same SOP
        if(dragDropManager.indexToInsertAt > node.clientSideAdditions.parentObjectIndex ) {
          dragDropManager.indexToInsertAt = dragDropManager.indexToInsertAt - 1;
        }
      }
      
      if(dragDropManager.indexToInsertAt === 'last') { // Calc of what's the last array index
        dragDropManager.indexToInsertAt = target.sop.length;
      }
      
      if(typeof node.clientSideAdditions !== 'undefined' && node.clientSideAdditions.parentObject.isa === 'Sequence' && typeof node.clientSideAdditions.parentObject.clientSideAdditions.parentObject.sop !== 'undefined' && node.clientSideAdditions.parentObject.sop.length === 0) { // Remove empty Sequence classes left behind
        //console.log('Empty sequence class left. I remove it.');
        node.clientSideAdditions.parentObject.clientSideAdditions.lines.forEach( function(line) {
          line.drawnLine.remove(); line.drawnShadow.remove();
        });
        node.clientSideAdditions.parentObject.clientSideAdditions.parentObject.sop.splice(node.clientSideAdditions.parentObject.clientSideAdditions.parentObjectIndex, 1)
      }

      target.sop.splice(dragDropManager.indexToInsertAt, 0, node); // Insertion at the new position
      
    };
    
    factory.wrapAsSequence = function(node) {
      var sequence = {
        isa : 'Sequence',
        sop : []
      };
      sequence.sop.push(node);
      return sequence;
    };

    factory.removeHighlights = function(within) {
      if(!within) {
        if(dragDropManager.droppable && dragDropManager.droppable.node.getAttribute('shadow') === 'true') {
          dragDropManager.droppable.attr({opacity:0});
        } else if (dragDropManager.droppable && dragDropManager.droppable.node.getAttribute('shadow') === 'false'){
          dragDropManager.droppable.attr({'fill':'#D8D8D8'});
        }
        dragDropManager.droppable = false;
      }
    };

    factory.executeDrop = function(node, dirScope, paper, measures, remove) {
      var objToInsertInIndex = dragDropManager.droppable.node.getAttribute('objToInsertInIndex');
      dragDropManager.objToInsertIn = dragDropManager.objToInsertInArray[objToInsertInIndex];
      dragDropManager.indexToInsertAt = dragDropManager.droppable.node.getAttribute('indexToInsertAt');
      var expectSequence = dragDropManager.droppable.node.getAttribute('expectSequence');
      factory.removeHighlights(false);
      if(factory.isMoveNecessary(node)) {
        if(remove) {
          factory.removeNode(node, true);
        }
        factory.insertNode(node, expectSequence);
        factory.calcAndDrawSop(dirScope, paper, true, false, true);
      }
      dirScope.$digest();
    };

    factory.highlightDroppable = function(objDraggedOver) {

      if (dragDropManager.droppable !== objDraggedOver) {
        if (dragDropManager.droppable && dragDropManager.droppable.node.getAttribute('shadow') === 'true') {
          dragDropManager.droppable.attr({opacity: 0});
        } else if (dragDropManager.droppable && dragDropManager.droppable.node.getAttribute('shadow') === 'false') {
          dragDropManager.droppable.attr({'fill': '#D8D8D8'});
        }
        dragDropManager.droppable = objDraggedOver;
      }

      var within;
      if (objDraggedOver.node.getAttribute('droppable') === 'true') {
        within = true;
        if (objDraggedOver.node.getAttribute('shadow') === 'true') {
          objDraggedOver.attr({opacity: 0.5});
        } else {
          objDraggedOver.attr({'fill': '#FF0000'});
        }
      } else {
        within = false;
      }
      return within;

    };
    
    factory.makeDraggable = function(drawObj, originalx, originaly, draggedSop, paper, dirScope, measures) {
      var
        within=false,
        lx = 0, 
        ly = 0,
        ox = originalx,
        oy = originaly,

        dragStart = function() {
          drawObj.attr({opacity: 0.5});
        },
        
        move = function(dx, dy) {          
          lx = dx + ox;  // add the new change in x to the drag origin
          ly = dy + oy;  // do the same for y
          drawObj.transform('T' + lx + ',' + ly);
          factory.removeHighlights(within);
          within = false;
        },
        
        up = function() {
          drawObj.attr({opacity: 1});
          if(dragDropManager.droppable) {
            ox = lx;
            oy = ly;
            factory.executeDrop(draggedSop, dirScope, paper, measures, true);
          } else {
            drawObj.animate({transform:'T' + ox + ',' + oy}, measures.animTime);
          }
        },
        
        over = function() {
          $('.paper').css('cursor','move');
        },
        
        out = function() {
          $('.paper').css('cursor','default');
        },

        dragOver = function(objDraggedOver) {
          within = factory.highlightDroppable(objDraggedOver);
        };

      drawObj.undrag();
      drawObj.unmouseover();
      drawObj.unmouseout();
      drawObj.drag(move, dragStart, up);
      drawObj.mouseover(over);
      drawObj.mouseout(out);
      drawObj.onDragOver(dragOver);
    
    };
    
    factory.drawLine = function(line, measures, paper, objToInsertIn, indexToInsertAt, typeDependentLineColor, dirScope) {
      var tempSet = paper.set();
      
      if(!dirScope.sopSpecCopy.vertDir) { // Swap x1,y1 and x2,y2 if Horizontal direction
        line.x1 = [line.y1, line.y1 = line.x1][0];
        line.x2 = [line.y2, line.y2 = line.x2][0];
      }

      if(typeof line.drawn === 'undefined') { // Draw
        line.drawnLine = paper.path('M ' + line.x1 + ' ' + line.y1 + ' l ' + line.x2 + ' ' + line.y2).attr({opacity: 0, stroke: measures.commonLineColor}).toBack();
        var lineAnim = Raphael.animation({opacity:1});
        line.drawnLine.animate(lineAnim.delay(measures.animTime));
        line.drawnShadow = paper.path('M ' + line.x1 + ' ' + line.y1 + ' l ' + line.x2 + ' ' + line.y2).attr({stroke: '#FF0000', 'stroke-width': 30, opacity: 0});
        if(dirScope.windowStorage.editable) {
          factory.makeDroppable(tempSet.push(line.drawnShadow), true, objToInsertIn, indexToInsertAt, true, dirScope, paper, measures);
        }
        /*dirScope.$watch(function() { // Animate on change
          return line.x1+line.y1+line.x2+line.y2;
        }, function(newValues, oldValues) {
          if(newValues !== oldValues) {
            line.drawnLine.animate({path:'M ' + line.x1 + ' ' + line.y1 + ' l ' + line.x2 + ' ' + line.y2}, measures.animTime);
            line.drawnShadow.attr({path:'M ' + line.x1 + ' ' + line.y1 + ' l ' + line.x2 + ' ' + line.y2});
          }
        });
        */
        line.drawn = true;
      }
    };

    return factory
  }]);
