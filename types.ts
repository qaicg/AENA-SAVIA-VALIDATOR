
// ... (mantenemos los tipos existentes)
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

// --- TIPOS EXISTENTES ---
export interface SaleHeader {
  COD_TRANSACC: string;
  FECHA_REAL: string;
  HORA_REAL: string;
  NUM_Z: string;
  NUM_TICKET: string;
  TIPO_VENTA: number;
  IMPNETO_T: number;
  IMPBRUTO_T: number;
  IMPIMPUESTOS_T: number;
  IMPDESCUENTO_T: number;
  DTO_PORC_1: number;
  N_ARTICULOS: number;
  N_UDS: number;
  DTO_PORC_2: number;
  DTO_PORC_3: number;
}

export interface SaleItemLine {
  ID_REGISTRO_A: string;
  CD_ARTICULO: string;
  TIPO_SUBFAMILIA: number;
  IMPNETO_A: number;
  IMPBRUTO_A: number;
  UDS_A: number;
  IMPVENTA_A: number;
  IMPDESCUENTO_1: number;
  TIPO_FISCAL: number;
  TAX_RATE: number;
  IMPDESCUENTO_2: number;
  IMPDESCUENTO_3: number;
}

export interface SaleTaxLine {
  ID_REGISTRO: string;
  TIPO_IMPUESTO: number; 
  BASE: number; 
  CUOTA: number;
}

export interface SalePaymentLine {
  ID_REGISTRO: string;
  TIPO_MEDIO: number; 
  IMPORTE: number;
}

export interface ParsedSale11004 {
  fileName: string;
  rawContent: string;
  header: SaleHeader;
  items: SaleItemLine[];
  taxes: SaleTaxLine[];
  payments: SalePaymentLine[];
}

export interface SummaryHeader {
  COD_TRANSACC: string;
  FECHA_REAL: string;
  NUM_Z: string;
  CD_TICKET_I: string;
  CD_TICKET_F: string;
  N_VENTAS: number;
  IMPBRUTO_V: number;
  IMPNETO_V: number;
  IMPDESCUENTO_V: number;
  N_DEVOLUCIONES: number;
  IMPBRUTO_D: number;
  IMPNETO_D: number;
  IMPDESCUENTO_D: number;
}

export interface SummaryAggregationLine {
  ID_REGISTRO: string; 
  TIPO_FAMILIA: number;
  TIPO_SUBFAMILIA: number;
  TIPO_FISCAL: number;
  ARTICULOS_V: number;
  IMPBRUTO_VSFZ: number;
  IMPNETO_VSFZ: number;
  IMPDESCUENTO_VSFZ: number;
  ARTICULOS_D: number;
  IMPBRUTO_DSFZ: number;
  IMPNETO_DSFZ: number;
  IMPDESCUENTO_DSFZ: number;
}

export interface ParsedSummary11008 {
  fileName: string;
  header: SummaryHeader;
  aggregations: SummaryAggregationLine[];
}

export interface SystemEventHeader {
  COD_TRANSACC: string;
  NUM_Z: string;
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
  groups: Record<string, SubfamilyAggregation>;
  global: {
    totalGrossSale: number;
    totalNetSale: number;
    totalDiscountSale: number;
    countSale: number;
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
      gross: number;
      base: number;
  }[];
}

export interface SingleFileInspection {
    fileName: string;
    ticketNum: string;
    checks: {
        label: string;
        headerValue: number | string;
        calcValue: number | string;
        diff: number | string;
        isOk: boolean;
        isWarning?: boolean;
    }[];
    lines: SaleItemLine[];
    taxes: SaleTaxLine[];
    payments: SalePaymentLine[];
}

// --- NUEVOS TIPOS PARA API ---

export interface ApiResponse {
  certified: boolean;
  timestamp: string;
  summary: {
    totalFiles: number;
    errors: number;
    warnings: number;
  };
  results: ValidationResult[];
  reportUrl: string;
}

export interface ApiDocumentation {
  endpoint: string;
  method: string;
  params: {
    name: string;
    type: string;
    description: string;
  }[];
}
