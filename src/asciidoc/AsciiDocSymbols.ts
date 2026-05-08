export interface AsciiDocXrefSymbol {
  target: string;
  line: number;
  column: number;
}

export interface AsciiDocIncludeSymbol {
  target: string;
  line: number;
  column: number;
}

export interface AsciiDocAttributeReference {
  name: string;
  line: number;
  column: number;
}

export interface AsciiDocSymbols {
  xrefs: AsciiDocXrefSymbol[];
  includes: AsciiDocIncludeSymbol[];
  attributes: AsciiDocAttributeReference[];
}
