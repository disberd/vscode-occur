"use strict"
import * as vscode from "vscode";
interface DocVals {
  selection_range: vscode.DecorationOptions[];
}

export class DocVal {
  selection_range: vscode.DecorationOptions[];
  occurences: vscode.Range[]
  constructor(selec_range: vscode.DecorationOptions[] = [], occur: vscode.Range[] = []) {
    this.selection_range = selec_range;
    this.occurences = occur
  }
  // Function to remove the selection ranges
  clearSelection(): void {
      this.selection_range = []
  }
}