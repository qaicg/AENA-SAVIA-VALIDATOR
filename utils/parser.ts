
import { ParsedSale11004, ParsedSummary11008, ParsedSystemEvent, SaleHeader, SaleItemLine, SummaryAggregationLine, SummaryHeader, SystemEventHeader, TransactionType } from "../types";

export const parseAenaInt = (val: string): number => {
  if (!val || val.trim() === '') return 0;
  return parseInt(val, 10);
};

export const identifyTransactionType = (filename: string, content: string): TransactionType | null => {
  const codeInName = filename.substring(18, 23);
  if (Object.values(TransactionType).includes(codeInName as TransactionType)) {
    return codeInName as TransactionType;
  }
  const firstLine = content.split('\n')[0];
  const parts = firstLine.split('|');
  if (parts.length > 0 && Object.values(TransactionType).includes(parts[0] as TransactionType)) {
    return parts[0] as TransactionType;
  }
  return null;
};

export const parse11004 = (fileName: string, content: string): ParsedSale11004 => {
  const lines = content.trim().split(/\r?\n/);
  const headerParts = lines[0].split('|');
  
  // FIXED MAPPING BASED ON AUTOIT ValidacionFicheroAena.au3
  // Function ImporteNeto: Header[13] (Gross) - Header[14] (Tax) = Header[12] (Net)
  // [3] (Index 3) -> NUM_Z 
  // [4] (Index 4) -> NUM_TICKET
  // [6] (Index 6) -> TIPO_VENTA 
  // [11] (Index 11) -> IMPNETO_T (Pos 12) -- Was incorrectly Gross
  // [12] (Index 12) -> IMPBRUTO_T (Pos 13) -- Was incorrectly Net
  // [13] (Index 13) -> IMPIMPUESTOS_T (Pos 14)
  // [14] (Index 14) -> IMPDESCUENTO_T (Pos 15)
  // [15] (Index 15) -> DTO_PORC_1
  // [16] (Index 16) -> N_ARTICULOS (Pos 17)
  // [19] (Index 19) -> N_UDS (Pos 20)
  // [30] (Index 30) -> DTO_PORC_2
  // [32] (Index 32) -> DTO_PORC_3

  const header: SaleHeader = {
    COD_TRANSACC: headerParts[0],
    FECHA_REAL: headerParts[1],
    HORA_REAL: headerParts[2],
    NUM_Z: headerParts[3],
    NUM_TICKET: headerParts[4],
    TIPO_VENTA: parseAenaInt(headerParts[6]),
    
    IMPNETO_T: parseAenaInt(headerParts[11]), // Index 11 is Net (Base)
    IMPBRUTO_T: parseAenaInt(headerParts[12]), // Index 12 is Gross (Total)
    IMPIMPUESTOS_T: parseAenaInt(headerParts[13]),
    IMPDESCUENTO_T: parseAenaInt(headerParts[14]),
    
    DTO_PORC_1: parseAenaInt(headerParts[15]), // NEW
    N_ARTICULOS: parseAenaInt(headerParts[16]),
    N_UDS: parseAenaInt(headerParts[19]),
    
    DTO_PORC_2: parseAenaInt(headerParts[30]), // NEW
    DTO_PORC_3: parseAenaInt(headerParts[32]), // NEW
  };

  const items: SaleItemLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const p = line.split('|');
    const idRegistro = parseInt(p[0], 10);

    if (idRegistro >= 500 && idRegistro <= 599) {
      // FIXED MAPPING 5xx LINES
      // AutoIt SubfamiliasParser:
      // $SubfamiliaDiccionario.Add ("IMPNETO",$tempArray[6-1]) -> Index 5
      // $SubfamiliaDiccionario.Add ("IMPBRUTO",$tempArray[7-1]) -> Index 6
      // Index 9 -> IMPVENTA (Pos 10)
      
      items.push({
        ID_REGISTRO_A: p[0],
        CD_ARTICULO: p[1],
        TIPO_SUBFAMILIA: parseAenaInt(p[4]),
        IMPNETO_A: parseAenaInt(p[5]), // Index 5 is Net
        IMPBRUTO_A: parseAenaInt(p[6]), // Index 6 is Gross
        UDS_A: parseAenaInt(p[8]),
        IMPVENTA_A: parseAenaInt(p[9]), // NEW: Index 9 (Pos 10)
        IMPDESCUENTO_1: parseAenaInt(p[12]),
        TIPO_FISCAL: parseAenaInt(p[13]),
        TAX_RATE: parseAenaInt(p[14]),
        IMPDESCUENTO_2: parseAenaInt(p[19]),
        IMPDESCUENTO_3: parseAenaInt(p[21]),
      });
    }
  }

  return { fileName, rawContent: content, header, items };
};

export const parse11008 = (fileName: string, content: string): ParsedSummary11008 => {
  const lines = content.trim().split(/\r?\n/);
  const headerParts = lines[0].split('|');
  
  const header: SummaryHeader = {
    COD_TRANSACC: headerParts[0],
    FECHA_REAL: headerParts[1],
    NUM_Z: headerParts[4],
    
    CD_TICKET_I: headerParts[6], // Corrected Index: 6
    CD_TICKET_F: headerParts[7], // Corrected Index: 7

    N_VENTAS: parseAenaInt(headerParts[8]),
    IMPBRUTO_V: parseAenaInt(headerParts[9]),
    IMPNETO_V: parseAenaInt(headerParts[10]),
    IMPDESCUENTO_V: parseAenaInt(headerParts[11]),

    N_DEVOLUCIONES: parseAenaInt(headerParts[12]),
    IMPBRUTO_D: parseAenaInt(headerParts[13]),
    IMPNETO_D: parseAenaInt(headerParts[14]),
    IMPDESCUENTO_D: parseAenaInt(headerParts[15]),
  };

  const aggregations: SummaryAggregationLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const p = line.split('|');
    const idRegistro = parseInt(p[0], 10);
    
    if (idRegistro > 0) {
        aggregations.push({
          ID_REGISTRO: p[0],
          TIPO_FAMILIA: parseAenaInt(p[1]),
          TIPO_SUBFAMILIA: parseAenaInt(p[2]),
          TIPO_FISCAL: parseAenaInt(p[3]),
          
          ARTICULOS_V: parseAenaInt(p[4]),
          IMPBRUTO_VSFZ: parseAenaInt(p[5]),
          IMPNETO_VSFZ: parseAenaInt(p[6]),
          IMPDESCUENTO_VSFZ: parseAenaInt(p[7]),

          ARTICULOS_D: parseAenaInt(p[8]),
          IMPBRUTO_DSFZ: parseAenaInt(p[9]),
          IMPNETO_DSFZ: parseAenaInt(p[10]),
          IMPDESCUENTO_DSFZ: parseAenaInt(p[11]), // CORRECTED: Index 11, NOT 12
        });
    }
  }

  return { fileName, header, aggregations };
};

export const parseSystemEvent = (fileName: string, content: string, type: TransactionType): ParsedSystemEvent => {
    const firstLine = content.split('\n')[0];
    const parts = firstLine.split('|');
    return {
        fileName,
        type,
        header: {
            COD_TRANSACC: parts[0],
            NUM_Z: parts[3]
        }
    };
};
