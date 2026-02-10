
// Common Types
export enum TransactionType {
  START_DAY = '11001',
  END_DAY = '11002',
  SALE = '11004',
  SUMMARY = '11008'
}

export interface FileMetadata {
  name: string;
  size: number;
  content: string;
  parsedType?: TransactionType;
  isValidFormat: boolean;
  errors: string[];
}

// 11004 - Sales Transaction
export interface SaleHeader {
  COD_TRANSACC: string;
  FECHA_REAL: string;
  HORA_REAL: string;
  NUM_Z: string; // Pos 4 (Index 3)
  NUM_TICKET: string; // Pos 5 (Index 4)
  TIPO_VENTA: number; // Pos 7 (Index 6) - 1: Normal, 2: Return
  IMPNETO_T: number; // Pos 13 (Index 12)
  IMPBRUTO_T: number; // Pos 12 (Index 11) 
  IMPIMPUESTOS_T: number; // Pos 14 (Index 13)
  IMPDESCUENTO_T: number; // Pos 15 (Index 14)
  
  // Header Discount Percentages for Proration
  DTO_PORC_1: number; // Pos 16 (Index 15)
  N_ARTICULOS: number; // Pos 17 (Index 16)
  N_UDS: number; // Pos 20 (Index 19)
  
  DTO_PORC_2: number; // Pos 31 (Index 30)
  DTO_PORC_3: number; // Pos 33 (Index 32)
}

export interface SaleBody {
  // Simplified flat structure for validation
}

export interface SaleItemLine {
  ID_REGISTRO_A: string; // Pos 1 (Index 0) - 5xx
  CD_ARTICULO: string; // Pos 2 (Index 1)
  TIPO_SUBFAMILIA: number; // Pos 5 (Index 4)
  IMPNETO_A: number; // Pos 6 (Index 5)
  IMPBRUTO_A: number; // Pos 7 (Index 6)
  UDS_A: number; // Pos 9 (Index 8)
  IMPVENTA_A: number; // Pos 10 (Index 9) - Required for proration base
  IMPDESCUENTO_1: number; // Pos 13 (Index 12)
  TIPO_FISCAL: number; // Pos 14 (Index 13)
  TAX_RATE: number; // Pos 15 (Index 14)
  IMPDESCUENTO_2: number; // Pos 20 (Index 19)
  IMPDESCUENTO_3: number; // Pos 22 (Index 21)
}

export interface ParsedSale11004 {
  fileName: string;
  rawContent: string; // NEW: Required for syntax validation
  header: SaleHeader;
  items: SaleItemLine[];
}

// 11008 - Summary Transaction
export interface SummaryHeader {
  COD_TRANSACC: string; // Pos 1
  FECHA_REAL: string; // Pos 2
  NUM_Z: string; // Pos 5 (Index 4)
  
  CD_TICKET_I: string; // Pos 6 (Index 5) - Initial Ticket
  CD_TICKET_F: string; // Pos 7 (Index 6) - Final Ticket

  // Venta Normal (1)
  N_VENTAS: number; // Pos 9 (Index 8)
  IMPBRUTO_V: number; // Pos 10 (Index 9)
  IMPNETO_V: number; // Pos 11 (Index 10)
  IMPDESCUENTO_V: number; // Pos 12 (Index 11)

  // Devolucion (2)
  N_DEVOLUCIONES: number; // Pos 13 (Index 12)
  IMPBRUTO_D: number; // Pos 14 (Index 13)
  IMPNETO_D: number; // Pos 15 (Index 14)
  IMPDESCUENTO_D: number; // Pos 16 (Index 15)
}

export interface SummaryAggregationLine {
  ID_REGISTRO: string; 
  TIPO_FAMILIA: number; // Pos 2 (Index 1)
  TIPO_SUBFAMILIA: number; // Pos 3 (Index 2) - AutoIt uses this as key
  TIPO_FISCAL: number; // Pos 4 (Index 3)
  
  // Totals for this grouping
  ARTICULOS_V: number; // Pos 5 (Index 4) - Qty Venta
  IMPBRUTO_VSFZ: number; // Pos 6 (Index 5)
  IMPNETO_VSFZ: number; // Pos 7 (Index 6)
  IMPDESCUENTO_VSFZ: number; // Pos 8 (Index 7)

  ARTICULOS_D: number; // Pos 9 (Index 8) - Qty Devolucion
  IMPBRUTO_DSFZ: number; // Pos 10 (Index 9)
  IMPNETO_DSFZ: number; // Pos 11 (Index 10)
  IMPDESCUENTO_DSFZ: number; // Pos 13 (Index 12) - Note AutoIt skips index 11?
}

export interface ParsedSummary11008 {
  fileName: string;
  header: SummaryHeader;
  aggregations: SummaryAggregationLine[];
}

// 11001/11002 - Start/End Day (For Z Check)
export interface SystemEventHeader {
  COD_TRANSACC: string;
  NUM_Z: string; // Pos 4 (Index 3)
}

export interface ParsedSystemEvent {
  fileName: string;
  type: TransactionType;
  header: SystemEventHeader;
}

export interface ValidationResult {
  status: 'valid' | 'invalid' | 'warning';
  message: string;
  details?: {
    expected: string | number;
    actual: string | number;
    field: string;
    context: string;
  }[];
}

export interface SubfamilyAggregation {
    subFamily: number;
    
    // Calculated from 11004s
    grossSale: number;
    netSale: number;
    discountSale: number;
    qtySale: number;

    grossReturn: number;
    netReturn: number;
    discountReturn: number;
    qtyReturn: number;
}

export interface AggregatedData {
  // Key: SubFamily ID
  groups: Record<string, SubfamilyAggregation>;
  
  global: {
    totalGrossSale: number;
    totalNetSale: number;
    totalDiscountSale: number;
    countSale: number;
    
    // Ticket Range
    minTicket: number;
    maxTicket: number;

    totalGrossReturn: number;
    totalNetReturn: number;
    totalDiscountReturn: number;
    countReturn: number;
  }
}

export interface FileDiscountBreakdown {
  fileName: string;
  ticketNum: string;
  isReturn: boolean;
  subFamilies: {
      id: number;
      discount: number;
      gross: number; // IMPBRUTO (Final Paid)
      base: number;  // IMPVENTA (Original Value)
  }[];
}

export interface SingleFileInspection {
    fileName: string;
    ticketNum: string;
    checks: {
        label: string;
        headerValue: number | string;
        calcValue: number | string;
        diff: number | string; // 0 if match, otherwise the difference
        isOk: boolean;
        isWarning?: boolean; // For non-critical mismatches (like Discount header vs lines)
    }[];
    lines: SaleItemLine[];
}