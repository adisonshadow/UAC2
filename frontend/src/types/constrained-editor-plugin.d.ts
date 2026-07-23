declare module 'constrained-editor-plugin' {
  export type RestrictionRange = [number, number, number, number];

  export type RestrictionObject = {
    range: RestrictionRange;
    label?: string;
    allowMultiline?: boolean;
    validate?: (
      currentlyTypedValue: string,
      newRange: RestrictionRange,
      info: unknown,
    ) => boolean;
  };

  export type ConstrainedEditorInstance = {
    initializeIn: (editorInstance: unknown) => boolean;
    addRestrictionsTo: (model: unknown, ranges: RestrictionObject[]) => unknown;
    removeRestrictionsIn: (model: unknown) => boolean;
    disposeConstrainer?: () => boolean;
  };

  export function constrainedEditor(monaco: unknown): ConstrainedEditorInstance;
}
