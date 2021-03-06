/**
 * @license
 * PXT Blockly fork
 *
 * The MIT License (MIT)
 *
 * Copyright (c) Microsoft Corporation
 *
 * All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @fileoverview Utility functions for handling functions (pxt-blockly's custom procedures).
 */
'use strict';

/**
 * Type to represent a function parameter
 * @typedef {Object} FunctionParameter
 * @property {string} id The blockly ID of the param
 * @property {string} name the name of the param
 * @property {string} type the type of the param (string, number, boolean or a custom type)
 */

/**
 * @name Blockly.Functions
 * @namespace
 **/
goog.provide('Blockly.Functions');

goog.require('Blockly.Blocks');
goog.require('Blockly.constants');
goog.require('Blockly.Events.BlockChange');
goog.require('Blockly.Field');
goog.require('Blockly.Names');
goog.require('Blockly.Workspace');

/**
 * Constant to separate function names from variables and generated functions
 * when running generators.
 * @deprecated Use Blockly.PROCEDURE_CATEGORY_NAME
 */
Blockly.Functions.NAME_TYPE = Blockly.PROCEDURE_CATEGORY_NAME;

/**
  * Construct the blocks required by the flyout for the functions category.
  * @param {!Blockly.Workspace} workspace The workspace containing functions.
  * @return {!Array.<!Element>} Array of XML block elements.
  */
Blockly.Functions.flyoutCategory = function(workspace) {
  var xmlList = [];

  Blockly.Functions.addCreateButton_(workspace, xmlList);

  function populateFunctions(functionList, templateName) {
    for (var i = 0; i < functionList.length; i++) {
      var name = functionList[i].getName();
      var args = functionList[i].getArguments();
      // <block type="function_call" x="25" y="25">
      //   <mutation name="myFunc">
      //     <arg name="bool" type="boolean" id="..."></arg>
      //     <arg name="text" type="string" id="..."></arg>
      //     <arg name="num" type="number" id="..."></arg>
      //   </mutation>
      // </block>
      var block = goog.dom.createDom('block');
      block.setAttribute('type', templateName);
      block.setAttribute('gap', 16);
      var mutation = goog.dom.createDom('mutation');
      mutation.setAttribute('name', name);
      block.appendChild(mutation);
      for (var j = 0; j < args.length; j++) {
        var arg = goog.dom.createDom('arg');
        arg.setAttribute('name', args[j].name);
        arg.setAttribute('type', args[j].type);
        arg.setAttribute('id', args[j].id);
        mutation.appendChild(arg);
      }
      xmlList.push(block);
    }
  }

  var existingFunctions = Blockly.Functions.getAllFunctionDefinitionBlocks(workspace);
  populateFunctions(existingFunctions, 'function_call');
  return xmlList;
};

/**
 * Create the "Make a Block..." button.
 * @param {!Blockly.Workspace} workspace The workspace contianing procedures.
 * @param {!Array.<!Element>} xmlList Array of XML block elements to add to.
 * @private
 */
Blockly.Functions.addCreateButton_ = function(workspace, xmlList) {
  var button = goog.dom.createDom('button');
  var msg = Blockly.Msg.FUNCTION_CREATE_NEW;
  var callbackKey = 'CREATE_FUNCTION';
  var callback = function() {
    Blockly.Functions.createFunctionCallback_(workspace);
  };
  button.setAttribute('text', msg);
  button.setAttribute('callbackkey', callbackKey);
  workspace.registerButtonCallback(callbackKey, callback);
  xmlList.push(button);
};

/**
 * Find all the callers of a named function.
 * @param {string} name Name of function.
 * @param {!Blockly.Workspace} workspace The workspace to find callers in.
 * @return {!Array.<!Blockly.Block>} Array of caller blocks.
 */
Blockly.Functions.getCallers = function(name, workspace) {
  var callers = [];
  var blocks = workspace.getAllBlocks();
  // Iterate through every block and check the name.
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].getName) {
      var funcName = blocks[i].getName();
      // Function name may be null if the block is only half-built.
      if (funcName && Blockly.Names.equals(funcName, name)) {
        callers.push(blocks[i]);
      }
    }
  }
  return callers;
};

/**
 * Find the definition block for the named function.
 * @param {string} name Name of function.
 * @param {!Blockly.Workspace} workspace The workspace to search.
 * @return {!Blockly.Block} The function definition block, or null if not found.
 */
Blockly.Functions.getDefinition = function(name, workspace) {
  // Assume that a function definition is a top block.
  var blocks = workspace.getTopBlocks(false);
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].type === Blockly.FUNCTION_DEFINITION_BLOCK_TYPE && blocks[i].getName) {
      var funcName = blocks[i].getName();
      // Function name may be null if the block is only half-built.
      if (funcName && Blockly.Names.equals(funcName, name)) {
        return blocks[i];
      }
    }
  }
  return null;
};

/**
 * Find all user-created function definitions in a workspace.
 * @param {!Blockly.Workspace} root Root workspace.
 * @return {!Array.<Blockly.Block>} An array of function definition blocks.
 */
Blockly.Functions.getAllFunctionDefinitionBlocks = function(root) {
  // Assume that a function definition is a top block.
  var blocks = root.getTopBlocks(false);
  var allFunctions = [];
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].type === Blockly.FUNCTION_DEFINITION_BLOCK_TYPE) {
      allFunctions.push(blocks[i]);
    }
  }
  return allFunctions;
};

/**
 * Determines whether the specified type is custom or a built-in literal.
 * @param {string} argumentType The argument type to check,
 * @return {boolean} Whether the argument type is a custom type. A return value
 *  of false means the argument is a built-in literal.
 */
Blockly.Functions.isCustomType = function(argumentType) {
  return !(argumentType === 'boolean' ||
    argumentType === 'string' ||
    argumentType === 'number');
};


/**
 * Create a mutation for a brand new function.
 * @return {Element} The mutation for a new function.
 * @package
 */
Blockly.Functions.newFunctionMutation = function() {
  // <block type="function_definition">
  //   <mutation name="myFunc" functionid="..."></mutation>
  // </block>
  var mutationText =
    '<xml>' +
    '<mutation name="' + Blockly.Msg.FUNCTIONS_DEFAULT_FUNCTION_NAME + '" functionid="' + Blockly.utils.genUid() + '"></mutation>' +
    '</xml>';
  var mutation = Blockly.Xml.textToDom(mutationText).firstChild;
  mutation.removeAttribute('xmlns');
  return mutation;
};

/**
 * Returns a unique parameter name based on the given name (using a numbered
 * suffix).
 * @param {string} name Initial name.
 * @param {string[]} paramNames Existing parameter names.
 * @return {string} The unique parameter name. If the name was already unique,
 *  the original name is returned.
 */
Blockly.Functions.findUniqueParamName = function(name, paramNames) {
  while (!Blockly.Functions.isUniqueParamName(name, paramNames)) {
    // Collision with another parameter name.
    var r = name.match(/^(.*?)(\d+)$/);
    if (!r) {
      name += '2';
    } else {
      name = r[1] + (parseInt(r[2], 10) + 1);
    }
  }
  return name;
};

/**
 * Determines whether the given parameter name is unique among the given
 * parameter names.
 * @param {string} name Initial name.
 * @param {string[]} paramNames Existing parameter names.
 * @return {boolean} Whether the name is unique.
 */
Blockly.Functions.isUniqueParamName = function(name, paramNames) {
  if (!paramNames) return true;
  return paramNames.indexOf(name) === -1;
};

/**
 * Callback to create a new function.
 * @param {!Blockly.Workspace} workspace The workspace to create the new function on.
 * @private
 */
Blockly.Functions.createFunctionCallback_ = function(workspace) {
  Blockly.hideChaff();
  if (Blockly.selected) {
    Blockly.selected.unselect();
  }
  Blockly.Functions.editFunctionExternalHandler(
      Blockly.Functions.newFunctionMutation(),
      Blockly.Functions.createFunctionCallbackFactory_(workspace)
  );
};

/**
 * Callback factory for adding a new custom function from a mutation.
 * @param {!Blockly.Workspace} workspace The workspace to create the new function on.
 * @return {function(?Element)} callback for creating the new custom function.
 * @private
 */
Blockly.Functions.createFunctionCallbackFactory_ = function(workspace) {
  return function(mutation) {
    if (mutation) {
      var blockText =
        '<xml>' +
        '<block type="' + Blockly.FUNCTION_DEFINITION_BLOCK_TYPE + '">' +
        Blockly.Xml.domToText(mutation) +
        '</block>' +
        '</xml>';
      var blockDom = Blockly.Xml.textToDom(blockText);
      Blockly.Events.setGroup(true);
      var highestBlock = workspace.getTopBlocks(true)[0];
      var block = Blockly.Xml.domToBlock(blockDom.firstChild, workspace);

      if (highestBlock) {
        var highestBlockTopLeft = highestBlock.getBoundingRectangle().topLeft;
        var highestBlockY = highestBlockTopLeft.y;
        var highestBlockX = highestBlockTopLeft.x;
        var height = block.getHeightWidth().height;
        var gap = 20 / workspace.scale;
        var moveY = highestBlockY - height - gap;
        block.moveBy(highestBlockX, moveY);
        block.scheduleSnapAndBump();
      }

      workspace.centerOnBlock(block.id);
      Blockly.Events.setGroup(false);
    }
  };
};

/**
 * Callback for editing custom functions.
 * @param {!Blockly.Block} block The block that was right-clicked.
 * @private
 */
Blockly.Functions.editFunctionCallback_ = function(block) {
  // Edit can come from either the function definition or a function call.
  // Normalize by setting the block to the definition block for the function.
  if (block.type == Blockly.Functions_CALL_BLOCK_TYPE) {
    // This is a call block, find the definition block corresponding to the
    // name. Make sure to search the correct workspace, call block can be in flyout.
    var workspaceToSearch = block.workspace.isFlyout ?
        block.workspace.targetWorkspace : block.workspace;
    block = Blockly.Functions.getDefinition(block.getName(), workspaceToSearch);
  }
  // "block" now refers to the function definition block, it is safe to proceed.
  Blockly.hideChaff();
  if (Blockly.selected) {
    Blockly.selected.unselect();
  }
  Blockly.Functions.editFunctionExternalHandler(
      block.mutationToDom(),
      Blockly.Functions.editFunctionCallbackFactory_(block)
  );
};

/**
 * Callback factory for editing an existing custom function.
 * @param {!Blockly.Block} block The function prototype block being edited.
 * @return {function(?Element)} Callback for editing the custom function.
 * @private
 */
Blockly.Functions.editFunctionCallbackFactory_ = function(block) {
  return function(mutation) {
    if (mutation) {
      Blockly.Functions.mutateCallersAndDefinition(block.getName(), block.workspace, mutation);
    }
  };
};

/**
 * Callback to create a new function custom command block.
 * @public
 */
Blockly.Functions.editFunctionExternalHandler = function(/** mutator, callback */) {
  console.warn('External function editor must be overriden: Blockly.Functions.editFunctionExternalHandler');
};

/**
 * Make a context menu option for editing a custom function.
 * This appears in the context menu for function definitions and function
 * calls.
 * @param {!Blockly.BlockSvg} block The block where the right-click originated.
 * @return {!Object} A menu option, containing text, enabled, and a callback.
 * @package
 */
Blockly.Functions.makeEditOption = function(block) {
  var editOption = {
    enabled: true,
    text: Blockly.Msg.FUNCTIONS_EDIT_OPTION,
    callback: function() {
      Blockly.Functions.editFunctionCallback_(block);
    }
  };
  return editOption;
};

/**
 * Converts an argument reporter block's output type to its equivalent
 * TypeScript type. For literal types, this means the output type in all lower
 * case. For custom reporters, this the output type is taken as is.
 * @param {string} reporterOutputType The reporter's output type.
 * @return {string} The TypeScript type of the argument.
 * @package
 */
Blockly.Functions.getReporterArgumentType = function(reporterOutputType) {
  switch (reporterOutputType) {
    case 'Boolean':
    case 'Number':
    case 'String':
      return reporterOutputType.toLowerCase();
    default:
      return reporterOutputType;
  }
};


/**
 * Validate the given function mutation to ensure that:
 *  1) the function name is globally unique in the specified workspace
 *  2) the parameter names are unique among themselves
 *  3) the argument names are not the same as the function name
 * @param {!Element} mutation The proposed function mutation.
 * @param {!Blockly.Workspace} destinationWs The workspace to check for name uniqueness.
 * @return {boolean} Whether the function passes name validation or not.
 * @package
 */
Blockly.Functions.validateFunctionExternal = function(mutation, destinationWs) {
  // Check for empty function name.
  var funcName = mutation.getAttribute('name');
  var lowerCase = funcName.toLowerCase();

  if (!lowerCase) {
    Blockly.alert(Blockly.Msg.FUNCTION_WARNING_EMPTY_NAME);
    return false;
  }

  // Check for duplicate arg names and empty arg names.
  var seen = {};
  for (var i = 0; i < mutation.childNodes.length; ++i) {
    var arg = mutation.childNodes[i];
    var argName = arg.getAttribute('name');
    var normalizedArgName = argName.toLowerCase();
    if (!normalizedArgName) {
      Blockly.alert(Blockly.Msg.FUNCTION_WARNING_EMPTY_NAME);
      return false;
    }
    if (seen[normalizedArgName]) {
      Blockly.alert(Blockly.Msg.FUNCTION_WARNING_DUPLICATE_ARG);
      return false;
    }
    seen[normalizedArgName] = true;
  }

  // Check for function name also being an argument name.
  if (seen[lowerCase]) {
    Blockly.alert(Blockly.Msg.FUNCTION_WARNING_ARG_NAME_IS_FUNCTION_NAME);
    return false;
  }

  // Check if function name is in use by a variable.
  var allVarNames = destinationWs.getAllVariables().map(function(v) {
    return v.name.toLowerCase();
  });
  if (allVarNames.indexOf(lowerCase) !== -1) {
    Blockly.alert(Blockly.Msg.VARIABLE_ALREADY_EXISTS.replace('%1', lowerCase));
    return false;
  }

  // Check if function name is in use by a different function (it's ok if the
  // name is in use by the function we're editing - that means we've changed
  // the arguments without renaming the function).
  var funcId = mutation.getAttribute('functionid');
  var allFunctions = Blockly.Functions.getAllFunctionDefinitionBlocks(destinationWs);
  for (var i = 0; i < allFunctions.length; ++i) {
    if (allFunctions[i].getName().toLowerCase() === lowerCase &&
      allFunctions[i].getFunctionId() !== funcId) {
      Blockly.alert(Blockly.Msg.VARIABLE_ALREADY_EXISTS.replace('%1', lowerCase));
      return false;
    }
  }

  // Looks good.
  return true;
};

/**
 * Creates a map of argument name -> argument ID based on the specified
 * function mutation. If specified, can also create the inverse map:
 * argument ID -> argument name.
 * @param {!Element} mutation The function mutation to parse.
 * @param {boolean} inverse Whether to make the inverse map, ID -> name.
 * @return {!Object} A map of name -> ID, or ID -> name if inverse was true.
 * @package
 */
Blockly.Functions.getArgMap = function(mutation, inverse) {
  var map = {};
  for (var i = 0; i < mutation.childNodes.length; ++i) {
    var arg = mutation.childNodes[i];
    var key = inverse ? arg.getAttribute('id') : arg.getAttribute('name');
    var val = inverse ? arg.getAttribute('name') : arg.getAttribute('id');
    map[key] = val;
  }
  return map;
};

/**
 * Find and edit all callers and the definition of a function using a new
 * mutation.
 * @param {string} name Name of function.
 * @param {!Blockly.Workspace} ws The workspace to find callers in.
 * @param {!Element} mutation New mutation for the callers.
 * @package
 */
Blockly.Functions.mutateCallersAndDefinition = function(name, ws, mutation) {
  var definitionBlock = Blockly.Functions.getDefinition(name, ws);
  if (definitionBlock) {
    var callers = Blockly.Functions.getCallers(name, definitionBlock.workspace);
    callers.push(definitionBlock);
    Blockly.Events.setGroup(true);
    callers.forEach(function(caller) {
      var oldMutationDom = caller.mutationToDom();
      var oldMutation = oldMutationDom && Blockly.Xml.domToText(oldMutationDom);
      caller.domToMutation(mutation);
      var newMutationDom = caller.mutationToDom();
      var newMutation = newMutationDom && Blockly.Xml.domToText(newMutationDom);

      if (oldMutation != newMutation) {
        // Fire a mutation event to force the block to update.
        Blockly.Events.fire(new Blockly.Events.BlockChange(caller, 'mutation', null, oldMutation, newMutation));

        // For the definition, we also need to update all arguments that are
        // used inside the function.
        if (caller.id === definitionBlock.id) {
          // First, build a map of oldArgName -> argId from the old mutation,
          // and a map of argId -> newArgName from the new mutation.
          var oldArgNamesToIds = Blockly.Functions.getArgMap(oldMutationDom);
          var idsToNewArgNames = Blockly.Functions.getArgMap(newMutationDom, true);

          // Then, go through all descendants of the function definition and
          // look for argument reporters to update.
          definitionBlock.getDescendants().forEach(function(d) {
            if (!Blockly.Functions.isFunctionArgumentReporter(d)) {
              return;
            }

            // Find the argument ID corresponding to this old argument name.
            var argName = d.getFieldValue('VALUE');
            var argId = oldArgNamesToIds[argName];

            if (!idsToNewArgNames[argId]) {
              // That arg ID no longer exists on the new mutation, delete this
              // arg reporter.
              d.dispose();
            } else if (idsToNewArgNames[argId] !== argName) {
              // That arg ID still exists, but the name was changed, so update
              // this reporter's display text.
              d.setFieldValue(idsToNewArgNames[argId], 'VALUE');
            }
          });
        } else {
          // For the callers, we need to bump blocks that were connected to any
          // argument that has since been deleted.
          setTimeout(function() {
            caller.bumpNeighbours_();
          }, Blockly.BUMP_DELAY);
        }
      }
    });
    Blockly.Events.setGroup(false);
  } else {
    console.warn('Attempted to change function ' + name + ', but no definition block was found on the workspace');
  }
};

/**
 * Whether a block is a function argument reporter.
 * @param {!Blockly.BlockSvg} block The block that should be used to make this
 *     decision.
 * @return {boolean} True if the block is a function argument reporter.
 */
Blockly.Functions.isFunctionArgumentReporter = function(block) {
  return block.type === 'argument_reporter_boolean' ||
    block.type === 'argument_reporter_number' ||
    block.type === 'argument_reporter_string' ||
    block.type === 'argument_reporter_custom';
};
