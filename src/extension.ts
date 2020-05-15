// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { DocVal } from "./docval";
import { start } from "repl";

let prova: DocVal = new DocVal();

// Variable to store the selections ranges for the various documents
var docvals_vec: { [k: string]: DocVal } = {};

// Define the decoration for the selected text
const decorSelec = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255, 255, 255, 0.3)",
});

// Define the decoration for the occurrences
const decorOccur = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(200, 0, 0, 0.3)",
});

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "occur" is now active!');

  // Function that add the currently selected text to the highlighted region for variable search
  function AddSelections(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    var sel = textEditor.selections;
    let arr = docvals_vec[textEditor.document.fileName];
    sel.forEach((element) => {
      arr.selection_range.push({
        range: new vscode.Range(element.start, element.end),
      });
    });
    textEditor.setDecorations(decorSelec, arr.selection_range);
    // Set the context to true
    setSelecContext(true);
  }

  // Function to move the cursor to the previous occurence
  function prevOccurence(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    // Get the relevant DocVal array
    let arr = docvals_vec[doc.fileName];
    if (!arr.occurences.length) {
      return;
    }
    // Find the offsets at the beginning of each occurrence
    let endOffsets = arr.occurences.map(function (el) {
      return doc.offsetAt(el.start);
    });
    // offset at active cursor
    let currOffset = doc.offsetAt(textEditor.selection.active);
    // Find the index of the next occurence
    let occurIdx = endOffsets.reverse().findIndex(function (val) {
      return val < currOffset;
    });
    if (occurIdx == -1) {
      occurIdx = 0;
    }
    // Invert the index as we computed it reversing the array
    occurIdx = endOffsets.length - 1 - occurIdx
    // Move the cursor to the beginning of the next occurence
    textEditor.selection = new vscode.Selection(
      arr.occurences[occurIdx].start,
      arr.occurences[occurIdx].start
	);
	// Move the editor view if next occurrence is not visible
	textEditor.revealRange(arr.occurences[occurIdx])
  }

  // Function to move the cursor to the next occurence
  function nextOccurence(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    // Get the relevant DocVal array
    let arr = docvals_vec[doc.fileName];
    if (!arr.occurences.length) {
      return;
    }
    // Find the offsets at the beginning of each occurrence
    let startOffsets = arr.occurences.map(function (el) {
      return doc.offsetAt(el.start);
    });
    // offset at active cursor
    let currOffset = doc.offsetAt(textEditor.selection.active);
    // Find the index of the next occurence
    let occurIdx = startOffsets.findIndex(function (val) {
      return val > currOffset;
    });
    if (occurIdx == -1) {
      occurIdx = 0;
    }
    // Move the cursor to the beginning of the next occurence
    textEditor.selection = new vscode.Selection(
      arr.occurences[occurIdx].start,
      arr.occurences[occurIdx].start
	);
	// Move the editor view if next occurrence is not visible
	textEditor.revealRange(arr.occurences[occurIdx])
  }

  // Function to toggle the occurrence under cursor
  function toggleOccurence(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    let arr = docvals_vec[doc.fileName];
    if (!arr.occurences.length) {
      return;
    }
    // Find the idx of the occurrence containing the active cursor
    let curPos = textEditor.selection.active;
    let occurIdx = arr.occurences.findIndex(function (val) {
      return val.contains(curPos);
    });
    // Remove the selected occurrence
    arr.occurences.splice(occurIdx, 1);
    // Update the decorations
    textEditor.setDecorations(decorOccur, arr.occurences);
    if (!arr.occurences.length) {
      setOccurContext(false);
    }
  }

  // Function to create cursor at all occurences
  function createCursors(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    let arr = docvals_vec[doc.fileName];
    if (!arr.occurences.length) {
      return;
    }
    // Create the new selection array
    let sel_array: vscode.Selection[] = [];
    arr.occurences.forEach(function (el) {
      sel_array.push(newCursorSelection(el));
    });
    textEditor.selections = sel_array;
    // Remove the occurences
    removeOccurences(textEditor, textEditorEdit);
    // Remove the regionselection
    removeSelections(textEditor, textEditorEdit);
  }
  // Function to remove all occurences
  function removeOccurences(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    let arr = docvals_vec[doc.fileName];
    if (!arr.occurences.length) {
      return;
    }
    arr.occurences = [];
    // Update the decorations
	textEditor.setDecorations(decorOccur, arr.occurences);
	// Update the context
	setOccurContext(false)
  }

  const test = vscode.workspace.getConfiguration("vim");

  // Function to find all occurences of a selected text
  function findOccurences(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let doc = textEditor.document;
    let sel = textEditor.selection;
    let range = new vscode.Range(sel.start, sel.end);
    let arr = docvals_vec[doc.fileName];
    if (range.isEmpty) {
      // Prompt for search term using word under cursor default
      let word = doc.getText(doc.getWordRangeAtPosition(range.start));
      vscode.window
        .showInputBox({ prompt: "text to find:", value: word })
        .then(highlight_occurences);
    } else {
      highlight_occurences(doc.getText(range));
    }
    // Define the helper function
    function highlight_occurences(word: string | undefined): void {
      if (!word) {
        return;
      }
      let pattern = new RegExp(escapeRegExp(word), "gm");
      let sel_range = arr.selection_range;
      if (!sel_range.length) {
        // Search in the whole document
        sel_range.push({
          range: new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(Number.MAX_VALUE)
          ),
        });
      }
      sel_range.forEach((element) => {
        let offset = doc.offsetAt(element.range.start);
        let text = doc.getText(element.range);
        let match
        while (match = pattern.exec(text)) {
          let occ_end = doc.positionAt(pattern.lastIndex + offset);
          let occ_start = doc.positionAt(
            pattern.lastIndex + offset - match[0].length
          );
          arr.occurences.push(new vscode.Range(occ_start, occ_end));
        }
      });
      textEditor.setDecorations(decorOccur, arr.occurences);
      if (arr.occurences.length) {
        setOccurContext(true);
      }
    }
  }

  // Function that clears t
  function removeSelections(
    textEditor: vscode.TextEditor,
    textEditorEdit: vscode.TextEditorEdit
  ) {
    let arr = docvals_vec[textEditor.document.fileName];
    arr.clearSelection();
    textEditor.setDecorations(decorSelec, arr.selection_range);
    // Remove the selection context
    setSelecContext(false);
  }

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId pjrameter must match the command field in package.json

  context.subscriptions.push(
    vscode.commands.registerTextEditorCommand(
      "multi-occur.removeSelections",
      removeSelections
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.addSelection",
      AddSelections
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.nextOccurence",
      nextOccurence
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.prevOccurence",
      prevOccurence
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.toggleOccurence",
      toggleOccurence
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.removeOccurences",
      removeOccurences
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.createCursors",
      createCursors
    ),
    vscode.commands.registerTextEditorCommand(
      "multi-occur.findOccurences",
      findOccurences
    )
  );

  vscode.window.onDidChangeActiveTextEditor(
    onTextEditorChange,
    null,
    context.subscriptions
  );

  if (vscode.window.activeTextEditor) {
    onTextEditorChange(vscode.window.activeTextEditor);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

function onTextEditorChange(textEditor: vscode.TextEditor | undefined): any {
  if (textEditor) {
    let id = textEditor.document.fileName;
    if (!docvals_vec[id]) {
      docvals_vec[id] = new DocVal();
      setSelecContext(false);
      setOccurContext(false);
    } else {
      if (docvals_vec[id].selection_range.length) {
        textEditor.setDecorations(decorSelec, docvals_vec[id].selection_range);
        setSelecContext(true);
      } else {
        setSelecContext(false);
      }
      if (docvals_vec[id].selection_range.length) {
        textEditor.setDecorations(decorOccur, docvals_vec[id].occurences);
        setOccurContext(true);
      } else {
        setOccurContext(false);
      }
    }
  }
}

function newCursorSelection(range: vscode.Range): vscode.Selection {
  return new vscode.Selection(range.start, range.start);
}

function setSelecContext(value: boolean) {
  vscode.commands.executeCommand("setContext", "multi-occur.active_region", value);
}
function setOccurContext(value: boolean) {
  vscode.commands.executeCommand("setContext", "multi-occur.active_occur", value);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}